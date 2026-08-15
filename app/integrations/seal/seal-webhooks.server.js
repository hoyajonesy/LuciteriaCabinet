/**
 * Luciteria Collector Cabinet — Seal Webhook Handlers
 *
 * Routes normalized Seal webhook events to their handlers. Each handler is
 * idempotent (via the idempotency layer that wraps this router) and connects
 * subscription lifecycle events to the existing assignment engine + Shopify
 * draft order flow.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §4, §5, §8.
 */

import { prisma } from "../../lib/db.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { resolveCustomer } from "../../lib/customer-resolver.server.js";
import {
  processShipmentAssignment,
  refreshAssignmentPreview,
  notifyAdmins,
} from "../../lib/subscription-manager.server.js";
import {
  syncSubscription,
  ensureSubscriptionTier,
  recordBillingEvent,
} from "./seal-subscription-sync.server.js";
import { SEAL_EVENTS } from "./seal-types.js";
import { getFeatureFlag } from "../../lib/feature-flags.server.js";
import {
  ensureOnboardingForContract,
  resolveAssignmentGate,
  claimFirstAssignment,
  GATE_MODE,
} from "../../lib/subscription-onboarding.server.js";
import {
  SWAP_WINDOW_FLAG,
  pauseHeldShipments,
  resumeHeldShipments,
  handleCancelledHeldShipments,
} from "../../lib/swap-window.server.js";

const MODULE = "seal-webhooks";

/**
 * Route a normalized Seal payload to the correct handler.
 *
 * @param {string} eventType - canonical event type
 * @param {import('./seal-types.js').NormalizedSealPayload} payload
 * @returns {Promise<{ handled: boolean, action: string, result?: any }>}
 */
export async function routeSealEvent(eventType, payload) {
  logger.info(MODULE, `Routing Seal event: ${eventType}`, {
    contract: payload.subscriptionContractId,
    email: payload.customerEmail,
  });

  const handlers = {
    [SEAL_EVENTS.SUBSCRIPTION_CREATED]: handleSealSubCreated,
    [SEAL_EVENTS.SUBSCRIPTION_UPDATED]: handleSealSubUpdated,
    [SEAL_EVENTS.SUBSCRIPTION_CANCELLED]: handleSealCancelled,
    [SEAL_EVENTS.SUBSCRIPTION_PAUSED]: handleSealPaused,
    [SEAL_EVENTS.SUBSCRIPTION_ACTIVATED]: handleSealActivated,
    [SEAL_EVENTS.SUBSCRIPTION_PLAN_CHANGED]: handleSealPlanChanged,
    [SEAL_EVENTS.SUBSCRIPTION_ORDER_SKIPPED]: handleSealSkipped,
    [SEAL_EVENTS.SUBSCRIPTION_CONTRACT_RENEWED]: handleSealContractRenewed,
    [SEAL_EVENTS.SUBSCRIPTION_PRODUCT_SWAPPED]: handleSealProductSwapped,
    [SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED]: handleBillingSuccess,
    [SEAL_EVENTS.BILLING_ATTEMPT_FAILED]: handleBillingFailed,
  };

  const handler = handlers[eventType];
  if (!handler) {
    logger.warn(MODULE, `No handler for Seal event: ${eventType}`);
    return { handled: false, action: "ignored", result: { eventType } };
  }

  const result = await handler(payload);
  return { handled: true, action: eventType, result };
}

// ─────────────────────────────────────────────────────────────
// Subscription lifecycle handlers
// ─────────────────────────────────────────────────────────────

/**
 * subscription/created — new signup. Create records + trigger FIRST shipment.
 */
export async function handleSealSubCreated(payload) {
  const { user, customer } = await resolveCustomer(payload);
  await ensureSubscriptionTier(payload);

  const subscription = await syncSubscription({ customer, payload, isNew: true });

  // Mark the user active.
  await prisma.user.update({
    where: { id: user.id },
    data: { isSubscriber: true, subscriptionStatus: "ACTIVE" },
  }).catch((e) => logger.warn(MODULE, `user status update failed: ${e.message}`));

  const contractId = payload.subscriptionContractId || null;

  const { onboardingId, held, pipeline } = await runGatedFirstAssignment({
    user,
    customer,
    subscription,
    contractId,
    assignedPrice: payload.amountCharged ?? payload.price ?? subscription.priceUsd,
  });

  return {
    subscriptionId: subscription.id,
    userId: user.id,
    customerId: customer.id,
    shipmentId: pipeline.shipment?.id || null,
    assigned: pipeline.assignment?.product?.sku || null,
    requiresReview: Boolean(pipeline.exception),
    onboardingId,
    held,
  };
}

/**
 * FR-16/FR-17: run the gated first-shipment sequence for a contract.
 *
 * This is the SINGLE code path that decides whether a contract's very first
 * shipment goes out, and it is shared by BOTH webhook types that can trigger it
 * — subscription/created and billing_attempt/succeeded. Sharing it is what
 * closes the cross-webhook double-ship race: whichever webhook arrives first
 * (in either order) ensures the onboarding record exists, then the atomic
 * claimFirstAssignment check-and-set lets exactly one of them actually assign.
 *
 * Sequence (only meaningful when the gate flag is enabled and a contractId is
 * present):
 *   1. ensureOnboardingForContract — idempotent; guarantees the onboarding
 *      record exists BEFORE the claim, so a billing_attempt/succeeded that
 *      arrives BEFORE subscription/created can still be deduped.
 *   2. resolveAssignmentGate — a PENDING contract inside its grace window is
 *      HELD (no shipment), so we never ship a duplicate the subscriber owns.
 *   3. claimFirstAssignment — atomic check-and-set. Exactly one caller wins and
 *      runs processShipmentAssignment; the loser skips. Contracts with no
 *      onboarding record (flag off / legacy) always win the claim (legacy
 *      allow-through).
 *
 * @returns {Promise<{ onboardingId: string|null, held: boolean, claimed: boolean, pipeline: Object }>}
 */
async function runGatedFirstAssignment({ user, customer, subscription, contractId, assignedPrice }) {
  const gateEnabled = await getFeatureFlag("feature_subscription_onboarding_gate");
  const emptyPipeline = { shipment: null, assignment: null, exception: null };

  // ─── 1. Ensure the onboarding record exists FIRST (FR-16) ───
  let onboardingId = null;
  if (gateEnabled && contractId) {
    try {
      const { onboarding } = await ensureOnboardingForContract({
        user,
        customer,
        subscription,
        contractId,
      });
      onboardingId = onboarding?.id || null;
    } catch (e) {
      // Never let onboarding failures break the subscription flow.
      logger.warn(MODULE, `onboarding init failed: ${e.message}`);
    }
  }

  // ─── 2. Gate the first shipment (FR-16) ───
  let held = false;
  if (gateEnabled && contractId) {
    try {
      const gate = await resolveAssignmentGate({ userId: user.id, contractId, isFirstShipment: true });
      if (gate.mode === GATE_MODE.BLOCKED) {
        held = true;
        logger.info(MODULE, `First shipment HELD pending onboarding for contract ${contractId}`);
        await prisma.activityLog.create({
          data: {
            userId: user.id,
            action: "assignment_held_onboarding",
            details: JSON.stringify({ contractId, onboardingId, isFirstShipment: true }),
          },
        }).catch((e) => logger.warn(MODULE, `activity log (held) failed: ${e.message}`));
      }
    } catch (e) {
      // Fail open — never block the first shipment because of a gate error.
      logger.warn(MODULE, `first-shipment gate check failed (proceeding): ${e.message}`);
    }
  }

  // ─── 3. Trigger the first shipment, guarded by the atomic claim (FR-17) ───
  let pipeline = emptyPipeline;
  let claimed = false;
  if (!held) {
    claimed = await claimFirstAssignment(contractId);
    if (claimed) {
      pipeline = await processShipmentAssignment({
        customer,
        subscription,
        isFirstShipment: true,
        assignedPrice,
      });
    } else {
      logger.info(MODULE, `First assignment already claimed for contract ${contractId} — skipping duplicate trigger`);
    }
  }

  return { onboardingId, held, claimed, pipeline };
}

/**
 * subscription/updated — generic status change. Delegates to the specific
 * pause/resume/cancel handler based on the normalized status.
 */
export async function handleSealSubUpdated(payload) {
  const status = payload.status;
  switch (status) {
    case "cancelled":
      return handleSealCancelled(payload);
    case "paused":
      return handleSealPaused(payload);
    case "active":
      return handleSealActivated(payload);
    case "past_due":
      return handleBillingFailed(payload);
    default: {
      // Just sync whatever changed.
      const { customer } = await resolveCustomer(payload);
      const subscription = await syncSubscription({ customer, payload });
      return { subscriptionId: subscription.id, status: subscription.status };
    }
  }
}

/**
 * subscription/cancelled — fully cancel. Keep collection records intact.
 */
export async function handleSealCancelled(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) {
    logger.warn(MODULE, "cancel: subscription not found", {
      contract: payload.subscriptionContractId,
    });
    return { action: "cancel_skipped", reason: "subscription_not_found" };
  }

  const now = new Date();
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "cancelled", cancelledAt: now },
  });

  // Swap & Skip Window (FR-18/FR-32): a shipment in held_for_swap must NOT
  // auto-finalize and must NOT be silently swept to "skipped" by the blanket
  // updateMany below (its status matches neither of that filter's values, but we
  // handle it explicitly and non-destructively first). Held cycles are banked as
  // store credit (no refund) and the contract's skip credits get their
  // post-cancellation expiry. Runs before the sweep so the credit path executes.
  try {
    if (await getFeatureFlag(SWAP_WINDOW_FLAG)) {
      const res = await handleCancelledHeldShipments({ subscription, now });
      if (res.held) {
        logger.info(MODULE, `cancel: held-window handling`, res);
      }
    }
  } catch (e) {
    logger.error(MODULE, `cancel: held-window handling failed: ${e.message}`);
  }

  // Cancel any pending/scheduled shipments (do NOT touch shipped/delivered).
  await prisma.subscriptionShipment.updateMany({
    where: {
      subscriptionId: subscription.id,
      status: { in: ["scheduled", "assigned", "ordered"] },
    },
    data: { status: "skipped" },
  });

  // Clear preview sequence.
  await prisma.assignmentPreview.deleteMany({ where: { subscriptionId: subscription.id } });

  // Update the linked user flags.
  await updateUserSubscriptionStatus(subscription.customerId, "CANCELLED", false);
  await sendCustomerNotification(subscription.customerId, {
    title: "Subscription cancelled",
    body: "Your Luciteria subscription has been cancelled. Your collection remains yours to keep.",
    icon: "👋",
  });

  return { action: "cancelled", subscriptionId: subscription.id };
}

/**
 * subscription/paused — pause. Cancel scheduled shipments, pause clock.
 */
export async function handleSealPaused(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) return { action: "pause_skipped", reason: "subscription_not_found" };

  const pausedAt = new Date();
  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "paused", pausedAt },
  });

  // Swap & Skip Window (FR-17/FR-32): held_for_swap shipments must be preserved
  // non-destructively — their remaining window time is captured and the shipment
  // is left held (NOT swept to "skipped"). Runs before the blanket updateMany;
  // held_for_swap is not in that filter, so this is the only handling it gets.
  try {
    if (await getFeatureFlag(SWAP_WINDOW_FLAG)) {
      const res = await pauseHeldShipments(subscription.id, { now: pausedAt });
      if (res.paused) logger.info(MODULE, `pause: preserved ${res.paused} held window(s)`);
    }
  } catch (e) {
    logger.error(MODULE, `pause: held-window handling failed: ${e.message}`);
  }

  await prisma.subscriptionShipment.updateMany({
    where: { subscriptionId: subscription.id, status: { in: ["scheduled", "assigned"] } },
    data: { status: "skipped" },
  });

  // FR-25: Persist remaining grace window for PENDING onboarding
  if (payload.subscriptionContractId) {
    const onboarding = await prisma.subscriptionOnboarding.findUnique({
      where: { subscriptionContractId: payload.subscriptionContractId },
    });
    if (onboarding && onboarding.status === "PENDING" && onboarding.graceExpiresAt) {
      const now = new Date();
      const graceRemainingMs = onboarding.graceExpiresAt.getTime() - now.getTime();
      const graceRemainingSeconds = Math.max(0, Math.ceil(graceRemainingMs / 1000));
      
      await prisma.subscriptionOnboarding.update({
        where: { id: onboarding.id },
        data: { graceRemainingSeconds },
      });
      
      logger.info(MODULE, `Persisted grace window: ${graceRemainingSeconds}s for onboarding ${onboarding.id}`);
    }
  }

  await updateUserSubscriptionStatus(subscription.customerId, "PAUSED", true);
  await sendCustomerNotification(subscription.customerId, {
    title: "Subscription paused",
    body: "Your subscription is paused. Resume any time to continue building your collection.",
    icon: "⏸️",
  });

  return { action: "paused", subscriptionId: subscription.id };
}

/**
 * subscription/activated — resume/reactivate. Accrue paused time, trigger next.
 */
export async function handleSealActivated(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) {
    // A brand new activation without a prior record → treat like created.
    return handleSealSubCreated(payload);
  }

  // Accrue paused days if we were paused.
  let pausedDays = subscription.pausedDays || 0;
  if (subscription.pausedAt) {
    const days = Math.ceil((Date.now() - new Date(subscription.pausedAt).getTime()) / 86400000);
    pausedDays += Math.max(0, days);
  }

  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: {
      status: "active",
      pausedAt: null,
      pausedDays,
      nextShipmentDate: new Date(),
      nextBillingDate: payload.nextBillingDate || subscription.nextBillingDate,
    },
  });

  // FR-25: Restore grace window for PENDING onboarding
  if (payload.subscriptionContractId) {
    const onboarding = await prisma.subscriptionOnboarding.findUnique({
      where: { subscriptionContractId: payload.subscriptionContractId },
    });
    if (onboarding && onboarding.status === "PENDING" && onboarding.graceRemainingSeconds !== null) {
      const now = new Date();
      const newGraceExpiresAt = new Date(now.getTime() + (onboarding.graceRemainingSeconds * 1000));
      
      await prisma.subscriptionOnboarding.update({
        where: { id: onboarding.id },
        data: { 
          graceExpiresAt: newGraceExpiresAt,
          graceRemainingSeconds: null,
        },
      });
      
      logger.info(MODULE, `Restored grace window: ${onboarding.graceRemainingSeconds}s → new expiry ${newGraceExpiresAt.toISOString()} for onboarding ${onboarding.id}`);
    }
  }

  // Swap & Skip Window (FR-17): restore any preserved held windows before we
  // touch preview/assignment, recomputing each window's expiry from the captured
  // remaining time.
  try {
    if (await getFeatureFlag(SWAP_WINDOW_FLAG)) {
      const res = await resumeHeldShipments(subscription.id, { now: new Date() });
      if (res.resumed) logger.info(MODULE, `resume: restored ${res.resumed} held window(s)`);
    }
  } catch (e) {
    logger.error(MODULE, `resume: held-window handling failed: ${e.message}`);
  }

  await updateUserSubscriptionStatus(subscription.customerId, "ACTIVE", true);

  // Refresh the assignment preview for the resumed subscription.
  const customer = await prisma.customer.findUnique({ where: { id: subscription.customerId } });
  if (customer) {
    await refreshAssignmentPreview({ customer, subscription: updated }).catch((e) =>
      logger.warn(MODULE, `preview refresh failed on resume: ${e.message}`)
    );
  }

  await sendCustomerNotification(subscription.customerId, {
    title: "Subscription resumed",
    body: "Welcome back! Your subscription is active again.",
    icon: "▶️",
  });

  return { action: "activated", subscriptionId: subscription.id, pausedDays };
}

/**
 * subscription/plan_changed — customer swapped tiers. Update collection type.
 */
export async function handleSealPlanChanged(payload) {
  const { customer } = await resolveCustomer(payload);
  const subscription = await syncSubscription({ customer, payload });
  await ensureSubscriptionTier(payload);

  const newType = payload.collectionType;
  // Record the collection type change history.
  if (newType && customer.collectionType !== newType) {
    await prisma.collectionTypeChange
      .create({
        data: {
          customerId: customer.id,
          previousType: customer.collectionType,
          newType: newType,
          reason: "seal_plan_changed",
          changedBy: "seal",
        },
      })
      .catch((e) => logger.warn(MODULE, `collectionTypeChange log failed: ${e.message}`));

    await prisma.customer.update({
      where: { id: customer.id },
      data: { collectionType: newType },
    });
  }

  await refreshAssignmentPreview({ customer, subscription }).catch((e) =>
    logger.warn(MODULE, `preview refresh failed on plan change: ${e.message}`)
  );

  return { action: "plan_changed", subscriptionId: subscription.id, collectionType: newType };
}

/**
 * subscription/order_skipped — customer skipped an upcoming order.
 */
export async function handleSealSkipped(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) return { action: "skip_skipped", reason: "subscription_not_found" };

  // Mark the current scheduled/assigned shipment as skipped (no assignment run).
  const current = await prisma.subscriptionShipment.findFirst({
    where: { subscriptionId: subscription.id, status: { in: ["scheduled", "assigned"] } },
    orderBy: { shipmentDate: "desc" },
  });
  if (current) {
    await prisma.subscriptionShipment.update({
      where: { id: current.id },
      data: { status: "skipped" },
    });
  }

  // Advance next shipment date + recompute preview.
  const nextDate = payload.nextBillingDate || advanceOneMonth(subscription.nextShipmentDate);
  const updated = await prisma.subscription.update({
    where: { id: subscription.id },
    data: { nextShipmentDate: nextDate },
  });

  const customer = await prisma.customer.findUnique({ where: { id: subscription.customerId } });
  if (customer) {
    await refreshAssignmentPreview({ customer, subscription: updated }).catch(() => {});
  }

  return { action: "order_skipped", subscriptionId: subscription.id };
}

/**
 * subscription/contract_renewed — log renewal, ensure active.
 */
export async function handleSealContractRenewed(payload) {
  const { customer } = await resolveCustomer(payload);
  const subscription = await syncSubscription({ customer, payload });
  return { action: "contract_renewed", subscriptionId: subscription.id };
}

/**
 * subscription/product_swapped — queue an admin review (no self-service swaps).
 */
export async function handleSealProductSwapped(payload) {
  const subscription = await findSubscription(payload);
  const customer = subscription
    ? await prisma.customer.findUnique({ where: { id: subscription.customerId } })
    : (await resolveCustomer(payload)).customer;

  if (customer) {
    await prisma.assignmentException.create({
      data: {
        customerId: customer.id,
        reason: "product_swap_requested",
        details: `Customer requested a product swap via Seal. Line items: ${JSON.stringify(
          payload.lineItems || []
        )}`,
        status: "pending",
      },
    });
    await notifyAdmins(
      "Product swap requested",
      `${customer.firstName} ${customer.lastName} requested a subscription product swap. Review in Operations.`
    );
  }

  return { action: "product_swap_queued", customerId: customer?.id || null };
}

// ─────────────────────────────────────────────────────────────
// Billing handlers
// ─────────────────────────────────────────────────────────────

/**
 * billing_attempt/succeeded — the critical path. Monthly renewal charge
 * succeeded → run the assignment engine for this cycle.
 */
export async function handleBillingSuccess(payload) {
  const { user, customer } = await resolveCustomer(payload);

  let subscription = await findSubscription(payload);
  // If the billing event arrives before subscription/created, create the sub.
  if (!subscription) {
    await ensureSubscriptionTier(payload);
    subscription = await syncSubscription({ customer, payload, isNew: true });
  }

  // Record the billing event + update billing bookkeeping.
  await recordBillingEvent({ subscription, customer, payload, eventType: "charge_success" });

  // Re-read the (now updated) subscription.
  subscription = await prisma.subscription.findUnique({ where: { id: subscription.id } });

  // Determine whether this is the customer's first shipment.
  const priorShipments = await prisma.subscriptionShipment.count({
    where: { subscriptionId: subscription.id },
  });
  const isFirstShipment = priorShipments === 0;

  await prisma.user
    .update({ where: { id: user.id }, data: { subscriptionStatus: "ACTIVE" } })
    .catch(() => {});

  const assignedPrice = payload.amountCharged ?? subscription.priceUsd;

  // FR-16/FR-17: the FIRST shipment must go through the SAME gated,
  // atomically-claimed path that subscription/created uses. Seal realistically
  // fires BOTH subscription/created and billing_attempt/succeeded for the same
  // initial charge; without a shared claim the two webhook TYPES race and can
  // double-ship. runGatedFirstAssignment ensures the onboarding record exists
  // (so a billing event that arrives before subscription/created can still be
  // deduped) and then lets exactly one caller win the claim.
  if (isFirstShipment) {
    const { held, claimed, pipeline } = await runGatedFirstAssignment({
      user,
      customer,
      subscription,
      contractId: payload.subscriptionContractId || null,
      assignedPrice,
    });
    return {
      subscriptionId: subscription.id,
      shipmentId: pipeline.shipment?.id || null,
      assigned: pipeline.assignment?.product?.sku || null,
      isFirstShipment: true,
      held,
      // The sibling subscription/created webhook already claimed & shipped.
      alreadyClaimed: !held && !claimed,
      requiresReview: Boolean(pipeline.exception),
    };
  }

  // Renewals: run the assignment pipeline for this billing cycle. The renewal
  // gate (BACKSTOP_ONLY / flag-off logging) lives inside processShipmentAssignment.
  const pipeline = await processShipmentAssignment({
    customer,
    subscription,
    isFirstShipment: false,
    assignedPrice,
  });

  return {
    subscriptionId: subscription.id,
    shipmentId: pipeline.shipment?.id || null,
    assigned: pipeline.assignment?.product?.sku || null,
    isFirstShipment: false,
    requiresReview: Boolean(pipeline.exception),
  };
}

/**
 * billing_attempt/failed — all Seal retries exhausted. Mark past_due,
 * alert admin, do NOT run assignment.
 */
export async function handleBillingFailed(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) {
    logger.warn(MODULE, "billing failed: subscription not found", {
      contract: payload.subscriptionContractId,
    });
    return { action: "billing_failed_skipped", reason: "subscription_not_found" };
  }

  const customer = await prisma.customer.findUnique({ where: { id: subscription.customerId } });
  await recordBillingEvent({ subscription, customer, payload, eventType: "charge_failed" });

  await updateUserSubscriptionStatus(subscription.customerId, "PAST_DUE", true);

  await notifyAdmins(
    "⚠️ Subscription payment failed",
    `Payment failed for ${customer?.firstName || ""} ${customer?.lastName || ""} (${
      customer?.email || "unknown"
    }). Subscription marked past_due. No shipment assigned.`
  );

  return { action: "billing_failed", subscriptionId: subscription.id };
}

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

/**
 * Find a subscription by Seal contract id, Shopify contract id, or the
 * resolved customer's subscription.
 * @param {import('./seal-types.js').NormalizedSealPayload} payload
 * @returns {Promise<Object|null>}
 */
async function findSubscription(payload) {
  if (payload.subscriptionContractId) {
    const byContract = await prisma.subscription.findUnique({
      where: { appstleContractId: payload.subscriptionContractId },
    });
    if (byContract) return byContract;
  }
  if (payload.shopifyContractId) {
    const byShopify = await prisma.subscription.findUnique({
      where: { shopifyContractId: payload.shopifyContractId },
    });
    if (byShopify) return byShopify;
  }
  if (payload.customerEmail) {
    const customer = await prisma.customer.findUnique({
      where: { email: payload.customerEmail },
    });
    if (customer) {
      return prisma.subscription.findUnique({ where: { customerId: customer.id } });
    }
  }
  return null;
}

/** Update the linked User's subscriptionStatus/isSubscriber flags. */
async function updateUserSubscriptionStatus(customerId, status, isSubscriber) {
  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) return;
  const user = await prisma.user.findUnique({ where: { email: customer.email } });
  if (!user) return;
  await prisma.user
    .update({
      where: { id: user.id },
      data: { subscriptionStatus: status, isSubscriber },
    })
    .catch((e) => logger.warn(MODULE, `user status update failed: ${e.message}`));
}

/** Send an in-app notification to the customer's linked user (best-effort). */
async function sendCustomerNotification(customerId, { title, body, icon }) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) return;
    const user = await prisma.user.findUnique({ where: { email: customer.email } });
    if (!user) return;
    const { notify } = await import("../../lib/notifications-db.server.js");
    await notify(user.id, {
      category: "SYSTEM",
      title,
      body,
      linkUrl: "/app/cabinet/subscription",
      icon,
    });
  } catch (err) {
    logger.warn(MODULE, `sendCustomerNotification failed: ${err.message}`);
  }
}

/** Add one month to a date (safe copy). */
function advanceOneMonth(date) {
  const d = new Date(date || new Date());
  d.setMonth(d.getMonth() + 1);
  return d;
}
