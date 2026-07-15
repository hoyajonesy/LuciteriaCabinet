/**
 * Luciteria Collector Cabinet — Appstle Webhook Handlers
 *
 * Routes normalized Appstle webhook events to their handlers. Each handler is
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
} from "./appstle-subscription-sync.server.js";
import { APPSTLE_EVENTS } from "./appstle-types.js";

const MODULE = "appstle-webhooks";

/**
 * Route a normalized Appstle payload to the correct handler.
 *
 * @param {string} eventType - canonical event type
 * @param {import('./appstle-types.js').NormalizedAppstlePayload} payload
 * @returns {Promise<{ handled: boolean, action: string, result?: any }>}
 */
export async function routeAppstleEvent(eventType, payload) {
  logger.info(MODULE, `Routing Appstle event: ${eventType}`, {
    contract: payload.subscriptionContractId,
    email: payload.customerEmail,
  });

  const handlers = {
    [APPSTLE_EVENTS.SUBSCRIPTION_CREATED]: handleAppstleSubCreated,
    [APPSTLE_EVENTS.SUBSCRIPTION_UPDATED]: handleAppstleSubUpdated,
    [APPSTLE_EVENTS.SUBSCRIPTION_CANCELLED]: handleAppstleCancelled,
    [APPSTLE_EVENTS.SUBSCRIPTION_PAUSED]: handleAppstlePaused,
    [APPSTLE_EVENTS.SUBSCRIPTION_ACTIVATED]: handleAppstleActivated,
    [APPSTLE_EVENTS.SUBSCRIPTION_PLAN_CHANGED]: handleAppstlePlanChanged,
    [APPSTLE_EVENTS.SUBSCRIPTION_ORDER_SKIPPED]: handleAppstleSkipped,
    [APPSTLE_EVENTS.SUBSCRIPTION_CONTRACT_RENEWED]: handleAppstleContractRenewed,
    [APPSTLE_EVENTS.SUBSCRIPTION_PRODUCT_SWAPPED]: handleAppstleProductSwapped,
    [APPSTLE_EVENTS.BILLING_ATTEMPT_SUCCEEDED]: handleBillingSuccess,
    [APPSTLE_EVENTS.BILLING_ATTEMPT_FAILED]: handleBillingFailed,
  };

  const handler = handlers[eventType];
  if (!handler) {
    logger.warn(MODULE, `No handler for Appstle event: ${eventType}`);
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
export async function handleAppstleSubCreated(payload) {
  const { user, customer } = await resolveCustomer(payload);
  await ensureSubscriptionTier(payload);

  const subscription = await syncSubscription({ customer, payload, isNew: true });

  // Mark the user active.
  await prisma.user.update({
    where: { id: user.id },
    data: { isSubscriber: true, subscriptionStatus: "ACTIVE" },
  }).catch((e) => logger.warn(MODULE, `user status update failed: ${e.message}`));

  // Trigger the first shipment assignment immediately.
  const pipeline = await processShipmentAssignment({
    customer,
    subscription,
    isFirstShipment: true,
    assignedPrice: payload.amountCharged ?? payload.price ?? subscription.priceUsd,
  });

  return {
    subscriptionId: subscription.id,
    userId: user.id,
    customerId: customer.id,
    shipmentId: pipeline.shipment?.id || null,
    assigned: pipeline.assignment?.product?.sku || null,
    requiresReview: Boolean(pipeline.exception),
  };
}

/**
 * subscription/updated — generic status change. Delegates to the specific
 * pause/resume/cancel handler based on the normalized status.
 */
export async function handleAppstleSubUpdated(payload) {
  const status = payload.status;
  switch (status) {
    case "cancelled":
      return handleAppstleCancelled(payload);
    case "paused":
      return handleAppstlePaused(payload);
    case "active":
      return handleAppstleActivated(payload);
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
export async function handleAppstleCancelled(payload) {
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
export async function handleAppstlePaused(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) return { action: "pause_skipped", reason: "subscription_not_found" };

  await prisma.subscription.update({
    where: { id: subscription.id },
    data: { status: "paused", pausedAt: new Date() },
  });

  await prisma.subscriptionShipment.updateMany({
    where: { subscriptionId: subscription.id, status: { in: ["scheduled", "assigned"] } },
    data: { status: "skipped" },
  });

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
export async function handleAppstleActivated(payload) {
  const subscription = await findSubscription(payload);
  if (!subscription) {
    // A brand new activation without a prior record → treat like created.
    return handleAppstleSubCreated(payload);
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
export async function handleAppstlePlanChanged(payload) {
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
          reason: "appstle_plan_changed",
          changedBy: "appstle",
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
export async function handleAppstleSkipped(payload) {
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
export async function handleAppstleContractRenewed(payload) {
  const { customer } = await resolveCustomer(payload);
  const subscription = await syncSubscription({ customer, payload });
  return { action: "contract_renewed", subscriptionId: subscription.id };
}

/**
 * subscription/product_swapped — queue an admin review (no self-service swaps).
 */
export async function handleAppstleProductSwapped(payload) {
  const subscription = await findSubscription(payload);
  const customer = subscription
    ? await prisma.customer.findUnique({ where: { id: subscription.customerId } })
    : (await resolveCustomer(payload)).customer;

  if (customer) {
    await prisma.assignmentException.create({
      data: {
        customerId: customer.id,
        reason: "product_swap_requested",
        details: `Customer requested a product swap via Appstle. Line items: ${JSON.stringify(
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

  // Run the assignment pipeline for this billing cycle.
  const pipeline = await processShipmentAssignment({
    customer,
    subscription,
    isFirstShipment,
    assignedPrice: payload.amountCharged ?? subscription.priceUsd,
  });

  return {
    subscriptionId: subscription.id,
    shipmentId: pipeline.shipment?.id || null,
    assigned: pipeline.assignment?.product?.sku || null,
    isFirstShipment,
    requiresReview: Boolean(pipeline.exception),
  };
}

/**
 * billing_attempt/failed — all Appstle retries exhausted. Mark past_due,
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
 * Find a subscription by Appstle contract id, Shopify contract id, or the
 * resolved customer's subscription.
 * @param {import('./appstle-types.js').NormalizedAppstlePayload} payload
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
