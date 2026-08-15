/**
 * Luciteria Collector Cabinet — Subscription Swap & Skip Window
 * (feature_swap_skip_window)
 *
 * Implements the bounded "held" state between assignment and order placement:
 * once the Assignment Engine picks an item, the shipment is held for a
 * configurable window during which the subscriber may SWAP for another eligible
 * item (of equal-or-lesser retail value) or SKIP the cycle and bank the credit.
 * Taking no action ships the original pick when the window closes.
 *
 * Design invariants (FRD v1.2, Section 4):
 *   - Every path out of the held state uses a SINGLE atomic claim (a conditional
 *     updateMany, never check-then-write), mirroring the tested first-assignment
 *     claim in subscription-onboarding.server.js — so a shipment can never be
 *     finalized twice.
 *   - Order placement is deferred to finalizeShipment() (FR-33); the swap picker
 *     consumes computeEligiblePool() (FR-34) so it never drifts from the engine.
 *   - Settings are snapshotted onto the shipment when the window opens (FR-29) so
 *     a later settings edit never changes an in-flight shipment's terms.
 *
 * NOTE: subscription-manager.server.js imports a few helpers from here and this
 * module imports finalizeShipment/runAssignment/etc. from there. To keep the
 * circular reference safe under ESM, the cross-module calls into
 * subscription-manager are done via a lazy dynamic import at call time.
 */
import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";
import { getFeatureFlag } from "./feature-flags.server.js";
import { computeEligiblePool } from "./assignment-engine.server.js";
import { grantSkipCredit, expireSkipCreditsOnCancellation } from "./credits.server.js";
import { notify } from "./notifications-db.server.js";

const MODULE = "swap-window";

export const SWAP_WINDOW_FLAG = "feature_swap_skip_window";

export const HELD_STATUS = "held_for_swap";

export const SWAP_DECISION = {
  NONE: "NONE",
  SWAPPED: "SWAPPED",
  SKIPPED: "SKIPPED",
};

export const SWAP_EVENT_ACTION = {
  WINDOW_OPENED: "WINDOW_OPENED",
  SWAP: "SWAP",
  SKIP: "SKIP",
  AUTO_FINALIZE: "AUTO_FINALIZE",
  STAFF_OVERRIDE: "STAFF_OVERRIDE",
  PAUSED: "PAUSED",
  RESUMED: "RESUMED",
};

export const SWAP_EVENT_SOURCE = {
  CUSTOMER: "CUSTOMER",
  SYSTEM: "SYSTEM",
  STAFF: "STAFF",
};

// Proposed starting values (FRD Section 5 / Section 9). Used both as the DB
// singleton defaults and as a safe fallback if the row cannot be read.
export const DEFAULT_SWAP_WINDOW_SETTINGS = {
  windowLengthDays: 6,
  swapFinalizesImmediately: true,
  allowMultipleDecisionChanges: false,
  firstShipmentGetsWindow: true,
  backstopAssignmentGetsWindow: true,
  skipCreditStackableWithTierCredit: true,
  skipCreditRefundOnCancellation: false,
  skipCreditRedeemableAtCheckout: false,
  skipCreditExpiryDays: null,
  skipCreditPostCancellationDays: 90,
};

// Fields that participate in the settings audit trail (FR-28 / Section 6.5).
const AUDITED_SETTING_FIELDS = Object.keys(DEFAULT_SWAP_WINDOW_SETTINGS);

const SINGLETON_ID = "singleton";

/** Lazy import of subscription-manager to avoid an ESM circular init hazard. */
async function sm() {
  return import("./subscription-manager.server.js");
}

/** Is the swap/skip window feature enabled? */
export async function isSwapWindowEnabled() {
  return getFeatureFlag(SWAP_WINDOW_FLAG);
}

// ─────────────────────────────────────────────────────────────
// Settings (singleton) + audit
// ─────────────────────────────────────────────────────────────

/**
 * Read the singleton SwapWindowSettings, creating it with the proposed starting
 * values on first access.
 */
export async function getSwapWindowSettings() {
  let settings = await prisma.swapWindowSettings.findUnique({ where: { id: SINGLETON_ID } });
  if (!settings) {
    settings = await prisma.swapWindowSettings.create({
      data: { id: SINGLETON_ID, ...DEFAULT_SWAP_WINDOW_SETTINGS },
    });
    logger.info(MODULE, "Created SwapWindowSettings singleton with proposed starting values");
  }
  return settings;
}

/**
 * Update settings prospectively (FR-28) and record a field-level audit row for
 * every changed value (FR-28 / Section 6.5). Changes apply only to shipments
 * entering the held state AFTER the change — in-flight shipments keep their
 * snapshot (FR-29), which is enforced by enterSwapWindow, not here.
 *
 * @param {Object} params
 * @param {Object} params.changes - partial SwapWindowSettings field map
 * @param {string} params.adminUserId - AdminUser.id making the change
 * @returns {Promise<{ settings: Object, audits: Object[] }>}
 */
export async function updateSwapWindowSettings({ changes = {}, adminUserId }) {
  if (!adminUserId) throw new Error("adminUserId is required to change settings (audit attribution)");
  const current = await getSwapWindowSettings();

  const applied = {};
  const auditRows = [];
  for (const field of AUDITED_SETTING_FIELDS) {
    if (!(field in changes)) continue;
    const newVal = changes[field];
    const oldVal = current[field];
    if (oldVal === newVal) continue; // no-op, no audit
    applied[field] = newVal;
    auditRows.push({
      adminUserId,
      settingField: field,
      oldValue: oldVal === null || oldVal === undefined ? null : String(oldVal),
      newValue: String(newVal),
    });
  }

  if (Object.keys(applied).length === 0) {
    return { settings: current, audits: [] };
  }

  const [settings] = await prisma.$transaction([
    prisma.swapWindowSettings.update({
      where: { id: SINGLETON_ID },
      data: { ...applied, updatedByAdminUserId: adminUserId },
    }),
    ...auditRows.map((row) => prisma.swapWindowSettingsAudit.create({ data: row })),
  ]);

  logger.info(MODULE, `Settings updated by admin ${adminUserId}`, { fields: Object.keys(applied) });
  return { settings, audits: auditRows };
}

/** Read the settings change history (most recent first). */
export async function getSettingsAudit(limit = 100) {
  return prisma.swapWindowSettingsAudit.findMany({
    orderBy: { changedAt: "desc" },
    take: limit,
  });
}

// ─────────────────────────────────────────────────────────────
// Entering the held state
// ─────────────────────────────────────────────────────────────

/**
 * Decide whether a freshly-assigned shipment qualifies for a swap window
 * (FR-4 handled upstream — manual-review shipments never reach here).
 *
 * @param {Object} params
 * @param {boolean} params.isFirstShipment
 * @param {string|null} params.gateMode - onboarding gate mode if known (e.g. "BACKSTOP_ONLY")
 * @param {Object} params.settings
 */
export function shipmentIsWindowEligible({ isFirstShipment = false, gateMode = null, settings }) {
  if (isFirstShipment && !settings.firstShipmentGetsWindow) return false;
  if (gateMode === "BACKSTOP_ONLY" && !settings.backstopAssignmentGetsWindow) return false;
  return true;
}

/**
 * Transition an already-assigned shipment into the held state (FR-1/FR-2/FR-3),
 * snapshotting the settings terms in effect right now (FR-29).
 *
 * @param {Object} params
 * @param {string} params.shipmentId
 * @param {string} params.originalProductId - the item the engine picked
 * @param {Object} [params.settings] - resolved settings (fetched if omitted)
 * @param {string|null} [params.userId] - customer User.id for the WINDOW_OPENED event
 * @returns {Promise<Object>} the updated shipment
 */
export async function enterSwapWindow({ shipmentId, originalProductId, settings = null, userId = null }) {
  const s = settings || (await getSwapWindowSettings());
  const now = new Date();
  const windowExpiresAt = new Date(now.getTime() + s.windowLengthDays * 86400000);

  const shipment = await prisma.subscriptionShipment.update({
    where: { id: shipmentId },
    data: {
      status: HELD_STATUS,
      windowOpensAt: now,
      windowExpiresAt,
      originalProductId,
      swapDecision: SWAP_DECISION.NONE,
      decidedAt: null,
      finalizationClaimed: false,
      windowRemainingSeconds: null,
      appliedWindowLengthDays: s.windowLengthDays,
      appliedSwapFinalizesImmediately: s.swapFinalizesImmediately,
    },
  });

  await recordSwapEvent({
    shipmentId,
    action: SWAP_EVENT_ACTION.WINDOW_OPENED,
    source: SWAP_EVENT_SOURCE.SYSTEM,
    fromProductId: originalProductId,
    toProductId: null,
    userId,
    note: `Window opened for ${s.windowLengthDays} day(s); expires ${windowExpiresAt.toISOString()}`,
  });

  // FR-19: tell the collector their pick is ready and the window is open.
  try {
    const product = originalProductId
      ? await prisma.product.findUnique({ where: { id: originalProductId } })
      : null;
    await notifySwapWindowOpened({ shipment, product, deadline: windowExpiresAt });
  } catch (e) {
    logger.warn(MODULE, `window-opened notification failed for shipment ${shipmentId}: ${e.message}`);
  }

  logger.info(MODULE, `Shipment ${shipmentId} entered held state (expires ${windowExpiresAt.toISOString()})`);
  return shipment;
}

// ─────────────────────────────────────────────────────────────
// Swap-eligible pool (FR-5/FR-6/FR-34)
// ─────────────────────────────────────────────────────────────

/**
 * Compute the swap-eligible pool for a held shipment: the same eligibility
 * pipeline the engine uses (computeEligiblePool, FR-34), further limited to
 * items whose retail value is at or below the ORIGINAL item's retail value
 * (FR-6). Excludes the currently-assigned item itself.
 *
 * @param {Object} params
 * @param {Object} params.shipment - a held SubscriptionShipment
 * @returns {Promise<{ candidates: Object[], originalRetail: number, currentProductId: string|null }>}
 */
export async function computeSwapPool({ shipment }) {
  const { loadAssignmentContext } = await sm();
  const [subscription, customer] = await Promise.all([
    prisma.subscription.findUnique({ where: { id: shipment.subscriptionId } }),
    prisma.customer.findUnique({ where: { id: shipment.customerId } }),
  ]);
  if (!customer) throw new Error(`Customer not found for shipment ${shipment.id}`);

  const collectionType = subscription?.collectionType || customer.collectionType || "lucite";
  const ctx = await loadAssignmentContext(customer);

  // Resolve the tier constraints the engine would apply.
  const { getTierByCollectionType } = await import("./subscription-tiers-db.server.js");
  const tier = await getTierByCollectionType(collectionType);

  const pool = computeEligiblePool({
    customer: { ...customer, collectionType },
    ownedProductIds: ctx.ownedProductIds,
    shippedProductIds: ctx.shippedProductIds,
    preferences: ctx.preferences,
    allProducts: ctx.allProducts,
    collectionType,
    tier,
  });

  const candidates = pool.success ? pool.candidates : [];

  // FR-6: cap at the ORIGINAL item's retail value.
  const originalId = shipment.originalProductId;
  const original = originalId
    ? ctx.allProducts.find((p) => p.id === originalId) ||
      (await prisma.product.findUnique({ where: { id: originalId } }))
    : null;
  const originalRetail = original ? original.retailPrice || original.priceUsd || 0 : Infinity;

  // Currently-assigned item (may differ from original after a prior swap).
  const currentItem = await prisma.shipmentItem.findFirst({ where: { shipmentId: shipment.id } });
  const currentProductId = currentItem?.productId || originalId || null;

  const affordable = candidates.filter((p) => {
    const retail = p.retailPrice || p.priceUsd || 0;
    return retail <= originalRetail && p.id !== currentProductId;
  });

  return { candidates: affordable, originalRetail, currentProductId };
}

// ─────────────────────────────────────────────────────────────
// Atomic claims (FR-10/FR-12/FR-15)
// ─────────────────────────────────────────────────────────────

/**
 * The single atomic finalization claim (FR-15). Flips finalizationClaimed
 * false→true in one conditional update. Exactly one caller — a customer action
 * or the window-close job — can ever win.
 *
 * @param {string} shipmentId
 * @param {Object} [opts]
 * @param {boolean} [opts.requireDecisionNone] - also require swapDecision=NONE
 *   (used to enforce "first decision is final" when allowMultipleDecisionChanges
 *   is off, for customer-initiated terminal actions).
 * @returns {Promise<boolean>} true if this caller won the claim
 */
export async function claimFinalization(shipmentId, opts = {}) {
  const where = { id: shipmentId, finalizationClaimed: false };
  if (opts.requireDecisionNone) where.swapDecision = SWAP_DECISION.NONE;
  const res = await prisma.subscriptionShipment.updateMany({
    where,
    data: { finalizationClaimed: true },
  });
  return res.count === 1;
}

/**
 * Record a non-terminal swap decision atomically (used when
 * swapFinalizesImmediately is off — the shipment stays held and the order is
 * placed later by the window-close job). Guards against a racing skip/second
 * decision. Does NOT flip finalizationClaimed.
 *
 * @returns {Promise<boolean>} true if the decision was recorded
 */
async function claimDecision(shipmentId, { allowMultiple }) {
  const where = { id: shipmentId, status: HELD_STATUS, finalizationClaimed: false };
  if (!allowMultiple) where.swapDecision = SWAP_DECISION.NONE;
  const res = await prisma.subscriptionShipment.updateMany({
    where,
    data: { swapDecision: SWAP_DECISION.SWAPPED, decidedAt: new Date() },
  });
  return res.count === 1;
}

// ─────────────────────────────────────────────────────────────
// Event trail
// ─────────────────────────────────────────────────────────────

export async function recordSwapEvent({
  shipmentId,
  action,
  source,
  fromProductId = null,
  toProductId = null,
  userId = null,
  staffId = null,
  note = null,
}) {
  return prisma.shipmentSwapEvent.create({
    data: { shipmentId, action, source, fromProductId, toProductId, userId, staffId, note },
  });
}

/** Full decision history for a shipment (chronological). */
export async function getSwapHistory(shipmentId) {
  return prisma.shipmentSwapEvent.findMany({
    where: { shipmentId },
    orderBy: { createdAt: "asc" },
  });
}

// ─────────────────────────────────────────────────────────────
// Finalization (order placement) of a held shipment
// ─────────────────────────────────────────────────────────────

/**
 * Place the order for a held shipment's currently-assigned item, re-validating
 * eligibility first (FR-7). Assumes the caller has already won the atomic
 * finalization claim. On invalid inventory, opens an admin exception instead of
 * shipping blindly.
 *
 * @param {Object} params
 * @param {Object} params.shipment - the held shipment (post-claim)
 * @returns {Promise<{ ok: boolean, draftOrder: Object|null, exception: Object|null, product: Object|null }>}
 */
async function placeOrderForHeldShipment({ shipment }) {
  const { finalizeShipment, openException } = await sm();

  const [subscription, customer, item] = await Promise.all([
    prisma.subscription.findUnique({ where: { id: shipment.subscriptionId } }),
    prisma.customer.findUnique({ where: { id: shipment.customerId } }),
    prisma.shipmentItem.findFirst({ where: { shipmentId: shipment.id } }),
  ]);

  const productId = item?.productId || shipment.originalProductId;
  const product = productId ? await prisma.product.findUnique({ where: { id: productId } }) : null;

  // FR-7: re-validate at finalization time.
  if (!product || product.status !== "Active" || (product.inventoryQty ?? 0) <= 0) {
    const exception = await openException({
      customer,
      reason: "inventory_conflict",
      details: `Held shipment ${shipment.id}: assigned item ${product?.sku || productId} is no longer eligible at finalization (out of stock / inactive).`,
    });
    logger.warn(MODULE, `Finalization aborted for ${shipment.id} — item no longer eligible; exception opened`);
    return { ok: false, draftOrder: null, exception, product };
  }

  const { draftOrder, error } = await finalizeShipment({
    customer,
    product,
    shipment,
    assignedPrice: shipment.assignedPrice ?? subscription?.priceUsd ?? 0,
    isFirstShipment: /first/i.test(shipment.notes || ""),
  });

  if (error) {
    const exception = await openException({
      customer,
      reason: "inventory_conflict",
      details: `Draft order creation failed finalizing held shipment ${shipment.id} (${product.title}): ${error.message}`,
    });
    return { ok: false, draftOrder: null, exception, product };
  }

  return { ok: true, draftOrder, exception: null, product };
}

// ─────────────────────────────────────────────────────────────
// Customer actions: swap / skip
// ─────────────────────────────────────────────────────────────

/**
 * Swap the held shipment's assigned item for another eligible item (FR-9/FR-10/FR-11).
 *
 * @param {Object} params
 * @param {string} params.shipmentId
 * @param {string} params.newProductId
 * @param {string|null} [params.userId] - the acting customer's User.id
 * @returns {Promise<Object>} outcome descriptor
 */
export async function swapShipment({ shipmentId, newProductId, userId = null }) {
  const shipment = await prisma.subscriptionShipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);
  if (shipment.status !== HELD_STATUS) {
    return { ok: false, reason: "not_held", message: "This shipment is no longer open for changes." };
  }

  const settings = await getSwapWindowSettings();
  const finalizesImmediately = shipment.appliedSwapFinalizesImmediately ?? settings.swapFinalizesImmediately;
  const allowMultiple = settings.allowMultipleDecisionChanges;

  // Validate the target against the swap-eligible pool (FR-5/FR-6).
  const { candidates } = await computeSwapPool({ shipment });
  const target = candidates.find((p) => p.id === newProductId);
  if (!target) {
    return { ok: false, reason: "ineligible", message: "That item is not available to swap to." };
  }

  const currentItem = await prisma.shipmentItem.findFirst({ where: { shipmentId } });
  const fromProductId = currentItem?.productId || shipment.originalProductId || null;

  if (finalizesImmediately) {
    // FR-10/FR-11: atomically claim, then swap the item and place the order now.
    const won = await claimFinalization(shipmentId, { requireDecisionNone: !allowMultiple });
    if (!won) {
      return { ok: false, reason: "already_decided", message: "This shipment has already been finalized." };
    }

    await prisma.shipmentItem.deleteMany({ where: { shipmentId } });
    await prisma.shipmentItem.create({ data: { shipmentId, productId: target.id } });

    const retailPrice = target.retailPrice || target.priceUsd || 0;
    await prisma.subscriptionShipment.update({
      where: { id: shipmentId },
      data: { swapDecision: SWAP_DECISION.SWAPPED, decidedAt: new Date(), retailPrice },
    });

    const fresh = await prisma.subscriptionShipment.findUnique({ where: { id: shipmentId } });
    const result = await placeOrderForHeldShipment({ shipment: fresh });

    await recordSwapEvent({
      shipmentId,
      action: SWAP_EVENT_ACTION.SWAP,
      source: SWAP_EVENT_SOURCE.CUSTOMER,
      fromProductId,
      toProductId: target.id,
      userId,
      note: result.ok ? "Swap finalized immediately" : "Swap recorded; finalization needs admin (item ineligible/draft failed)",
    });

    if (result.ok) {
      try {
        await notifySwapOutcome({ shipment: fresh, kind: "swapped", product: target });
      } catch (e) {
        logger.warn(MODULE, `swap-outcome notification failed for shipment ${shipmentId}: ${e.message}`);
      }
    }

    return {
      ok: result.ok,
      finalized: result.ok,
      reason: result.ok ? null : "finalize_failed",
      draftOrder: result.draftOrder,
      exception: result.exception,
      product: target,
    };
  }

  // Non-immediate: record the decision, keep the shipment held; the window-close
  // job places the order later. Guard against a racing skip/second decision.
  const recorded = await claimDecision(shipmentId, { allowMultiple });
  if (!recorded) {
    return { ok: false, reason: "already_decided", message: "A decision has already been made for this shipment." };
  }

  await prisma.shipmentItem.deleteMany({ where: { shipmentId } });
  await prisma.shipmentItem.create({ data: { shipmentId, productId: target.id } });
  await prisma.subscriptionShipment.update({
    where: { id: shipmentId },
    data: { retailPrice: target.retailPrice || target.priceUsd || 0 },
  });

  await recordSwapEvent({
    shipmentId,
    action: SWAP_EVENT_ACTION.SWAP,
    source: SWAP_EVENT_SOURCE.CUSTOMER,
    fromProductId,
    toProductId: target.id,
    userId,
    note: "Swap recorded; will ship when window closes",
  });

  return { ok: true, finalized: false, reason: null, product: target };
}

/**
 * Skip the held cycle (FR-12): atomically claim, place NO order, and bank store
 * credit equal to the cycle's assigned value using the type-agnostic
 * (contract, cycle) idempotency key.
 *
 * @param {Object} params
 * @param {string} params.shipmentId
 * @param {string|null} [params.userId]
 * @returns {Promise<Object>} outcome descriptor
 */
export async function skipShipment({ shipmentId, userId = null }) {
  const shipment = await prisma.subscriptionShipment.findUnique({ where: { id: shipmentId } });
  if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);
  if (shipment.status !== HELD_STATUS) {
    return { ok: false, reason: "not_held", message: "This shipment is no longer open for changes." };
  }

  const settings = await getSwapWindowSettings();
  const allowMultiple = settings.allowMultipleDecisionChanges;

  const [subscription, customer] = await Promise.all([
    prisma.subscription.findUnique({ where: { id: shipment.subscriptionId } }),
    prisma.customer.findUnique({ where: { id: shipment.customerId } }),
  ]);

  // Atomic terminal claim (FR-12/FR-15).
  const won = await claimFinalization(shipmentId, { requireDecisionNone: !allowMultiple });
  if (!won) {
    return { ok: false, reason: "already_decided", message: "This shipment has already been finalized." };
  }

  const currentItem = await prisma.shipmentItem.findFirst({ where: { shipmentId } });
  const fromProductId = currentItem?.productId || shipment.originalProductId || null;

  await prisma.subscriptionShipment.update({
    where: { id: shipmentId },
    data: { status: "skipped", swapDecision: SWAP_DECISION.SKIPPED, decidedAt: new Date() },
  });

  // Bank the credit (best-effort; the shipment is already skipped either way).
  let credit = null;
  try {
    const { resolveUserIdForCustomer } = await sm();
    const resolvedUserId = userId || (customer ? await resolveUserIdForCustomer(customer) : null);
    const contractId = subscription?.appstleContractId || subscription?.shopifyContractId || null;
    if (resolvedUserId && contractId) {
      const billingCycle = billingCycleFor(subscription, shipment);
      const amount = shipment.assignedPrice ?? subscription?.priceUsd ?? 0;
      let expiresAt = null;
      if (settings.skipCreditExpiryDays != null) {
        expiresAt = new Date(Date.now() + settings.skipCreditExpiryDays * 86400000);
      }
      if (amount > 0) {
        credit = await grantSkipCredit(
          resolvedUserId,
          contractId,
          billingCycle,
          amount,
          `Skipped subscription cycle ${billingCycle} — banked $${amount.toFixed(2)} store credit`,
          { expiresAt }
        );
      }
    } else {
      logger.warn(MODULE, `Skip credit not granted for shipment ${shipmentId} — missing userId/contractId`);
    }
  } catch (e) {
    logger.error(MODULE, `Skip credit grant failed for shipment ${shipmentId}: ${e.message}`);
  }

  await recordSwapEvent({
    shipmentId,
    action: SWAP_EVENT_ACTION.SKIP,
    source: SWAP_EVENT_SOURCE.CUSTOMER,
    fromProductId,
    toProductId: null,
    userId,
    note: credit
      ? credit.wasAlreadyGranted
        ? `Skip; credit already existed for this cycle (type ${credit.collidedType})`
        : `Skip; banked $${(credit.transaction?.amount ?? 0).toFixed(2)} credit`
      : "Skip; credit not granted",
  });

  try {
    const creditAmount = credit && !credit.wasAlreadyGranted ? credit.transaction?.amount ?? null : null;
    await notifySwapOutcome({ shipment, kind: "skipped", product: null, creditAmount });
  } catch (e) {
    logger.warn(MODULE, `skip-outcome notification failed for shipment ${shipmentId}: ${e.message}`);
  }

  return { ok: true, finalized: true, credit, reason: null };
}

// ─────────────────────────────────────────────────────────────
// Window-close job (FR-13/FR-21) — admin/cron-triggered, idempotent
// ─────────────────────────────────────────────────────────────

/**
 * Close expired swap windows: for every held shipment whose window has elapsed
 * and which has not yet been finalized, atomically claim it and place the order
 * for its currently-assigned item (the original pick, or a non-immediate swap
 * recorded earlier). Skipped shipments never match (they are already finalized).
 *
 * Idempotent and race-safe: finalization is claimed with the single-winner
 * `claimFinalization` guard, so re-running the job (or a concurrent customer
 * action) can never double-finalize a shipment. Per the FRD acceptance criteria,
 * this is admin/cron-triggered, not automatic.
 *
 * @param {Object} [params]
 * @param {Date} [params.now]
 * @returns {Promise<{ scanned: number, finalized: number, exceptions: number, skippedRace: number, errors: number }>}
 */
export async function runSwapWindowCloseJob({ now = new Date(), reminderThresholdHours = 24 } = {}) {
  // FR-20: pre-deadline reminders. Any still-undecided held shipment whose
  // deadline falls within the reminder window (but hasn't elapsed yet) gets a
  // single reminder. notify() dedupes on the per-shipment key, so re-running the
  // job never sends a second reminder — no schema change or "sent" flag needed.
  let remindersSent = 0;
  try {
    const reminderCutoff = new Date(now.getTime() + reminderThresholdHours * 3600000);
    const approaching = await prisma.subscriptionShipment.findMany({
      where: {
        status: HELD_STATUS,
        finalizationClaimed: false,
        swapDecision: SWAP_DECISION.NONE,
        windowExpiresAt: { not: null, gt: now, lte: reminderCutoff },
      },
    });
    for (const shipment of approaching) {
      try {
        const res = await notifySwapReminder({ shipment, deadline: shipment.windowExpiresAt });
        if (res) remindersSent++;
      } catch (e) {
        logger.warn(MODULE, `swap reminder failed for shipment ${shipment.id}: ${e.message}`);
      }
    }
  } catch (e) {
    logger.warn(MODULE, `swap reminder pass failed: ${e.message}`);
  }

  const due = await prisma.subscriptionShipment.findMany({
    where: {
      status: HELD_STATUS,
      finalizationClaimed: false,
      windowExpiresAt: { not: null, lte: now },
    },
  });

  const summary = { scanned: due.length, finalized: 0, exceptions: 0, skippedRace: 0, errors: 0, remindersSent };

  for (const shipment of due) {
    try {
      // Atomic terminal claim — the finalizationClaimed guard alone resolves any
      // race with a concurrent customer swap/skip regardless of decision value.
      const won = await claimFinalization(shipment.id);
      if (!won) {
        summary.skippedRace++;
        continue;
      }

      const fresh = await prisma.subscriptionShipment.findUnique({ where: { id: shipment.id } });
      const result = await placeOrderForHeldShipment({ shipment: fresh });

      const wasSwap = fresh.swapDecision === SWAP_DECISION.SWAPPED;
      await recordSwapEvent({
        shipmentId: shipment.id,
        action: SWAP_EVENT_ACTION.AUTO_FINALIZE,
        source: SWAP_EVENT_SOURCE.SYSTEM,
        fromProductId: fresh.originalProductId || null,
        toProductId: result.product?.id || null,
        note: result.ok
          ? wasSwap
            ? "Window closed — shipped the customer's swapped selection"
            : "Window closed — shipped the original assigned item"
          : "Window closed — finalization failed (item ineligible/draft failed); admin exception opened",
      });

      if (result.ok) {
        summary.finalized++;
        await notifySwapOutcome({ shipment: fresh, kind: wasSwap ? "swapped" : "shipped", product: result.product });
      } else {
        summary.exceptions++;
      }
    } catch (e) {
      summary.errors++;
      logger.error(MODULE, `Window-close finalize failed for shipment ${shipment.id}: ${e.message}`);
    }
  }

  logger.info(MODULE, "Swap window-close job complete", summary);
  return summary;
}

// ─────────────────────────────────────────────────────────────
// Pause / resume (FR-17 / FR-32) — non-destructive held handling
// ─────────────────────────────────────────────────────────────

/**
 * Pause any held shipments for a subscription (FR-17/FR-32). The remaining
 * window time is captured onto `windowRemainingSeconds` and the shipment is
 * LEFT in held_for_swap (never swept to "skipped"), so the pause handler neither
 * ignores nor destroys it. The countdown resumes on reactivation.
 *
 * @param {string} subscriptionId
 * @param {Object} [opts]
 * @param {Date} [opts.now]
 * @returns {Promise<{ paused: number }>}
 */
export async function pauseHeldShipments(subscriptionId, opts = {}) {
  const now = opts.now || new Date();
  const held = await prisma.subscriptionShipment.findMany({
    where: { subscriptionId, status: HELD_STATUS, finalizationClaimed: false },
  });

  let paused = 0;
  for (const s of held) {
    // If already captured (double pause), leave the earlier capture intact.
    if (s.windowRemainingSeconds != null) continue;
    const remainingMs = s.windowExpiresAt ? s.windowExpiresAt.getTime() - now.getTime() : 0;
    const windowRemainingSeconds = Math.max(0, Math.ceil(remainingMs / 1000));
    await prisma.subscriptionShipment.update({
      where: { id: s.id },
      data: { windowRemainingSeconds },
    });
    await recordSwapEvent({
      shipmentId: s.id,
      action: SWAP_EVENT_ACTION.PAUSED,
      source: SWAP_EVENT_SOURCE.SYSTEM,
      note: `Subscription paused — ${windowRemainingSeconds}s of window preserved`,
    });
    paused++;
  }
  if (paused) logger.info(MODULE, `Paused ${paused} held shipment(s) for subscription ${subscriptionId}`);
  return { paused };
}

/**
 * Resume held shipments for a subscription (FR-17). Recomputes
 * `windowExpiresAt = now + windowRemainingSeconds` and clears the capture,
 * mirroring the onboarding grace-window resume precedent.
 *
 * @param {string} subscriptionId
 * @param {Object} [opts]
 * @param {Date} [opts.now]
 * @returns {Promise<{ resumed: number }>}
 */
export async function resumeHeldShipments(subscriptionId, opts = {}) {
  const now = opts.now || new Date();
  const held = await prisma.subscriptionShipment.findMany({
    where: { subscriptionId, status: HELD_STATUS, windowRemainingSeconds: { not: null } },
  });

  let resumed = 0;
  for (const s of held) {
    const newExpiry = new Date(now.getTime() + s.windowRemainingSeconds * 1000);
    await prisma.subscriptionShipment.update({
      where: { id: s.id },
      data: { windowExpiresAt: newExpiry, windowRemainingSeconds: null },
    });
    await recordSwapEvent({
      shipmentId: s.id,
      action: SWAP_EVENT_ACTION.RESUMED,
      source: SWAP_EVENT_SOURCE.SYSTEM,
      note: `Subscription resumed — window now expires ${newExpiry.toISOString()}`,
    });
    resumed++;
  }
  if (resumed) logger.info(MODULE, `Resumed ${resumed} held shipment(s) for subscription ${subscriptionId}`);
  return { resumed };
}

// ─────────────────────────────────────────────────────────────
// Cancellation (FR-18) — never auto-finalize a held shipment
// ─────────────────────────────────────────────────────────────

/**
 * Handle held shipments when a subscription is cancelled (FR-18). A held
 * shipment MUST NOT auto-finalize into an order. Because the subscriber has
 * already been billed for the cycle and `skipCreditRefundOnCancellation` is off
 * (no cash refund), the cycle's value is banked as store credit — exactly like a
 * skip — and every outstanding skip credit for the contract is then given the
 * post-cancellation expiry (usable for `skipCreditPostCancellationDays`, then it
 * expires).
 *
 * @param {Object} params
 * @param {Object} params.subscription
 * @param {Object} [params.settings]
 * @param {Date} [params.now]
 * @returns {Promise<{ held: number, credited: number, refunded: boolean, expiryStamped: number }>}
 */
export async function handleCancelledHeldShipments({ subscription, settings = null, now = new Date() }) {
  const s = settings || (await getSwapWindowSettings());
  const contractId = subscription?.appstleContractId || subscription?.shopifyContractId || null;

  const held = await prisma.subscriptionShipment.findMany({
    where: { subscriptionId: subscription.id, status: HELD_STATUS, finalizationClaimed: false },
  });

  const { resolveUserIdForCustomer } = await sm();
  const customer = await prisma.customer.findUnique({ where: { id: subscription.customerId } });
  const resolvedUserId = customer ? await resolveUserIdForCustomer(customer) : null;

  let credited = 0;
  for (const shipment of held) {
    // Atomic claim so a racing window-close/customer action cannot also act.
    const won = await claimFinalization(shipment.id);
    if (!won) continue;

    const currentItem = await prisma.shipmentItem.findFirst({ where: { shipmentId: shipment.id } });
    const fromProductId = currentItem?.productId || shipment.originalProductId || null;

    await prisma.subscriptionShipment.update({
      where: { id: shipment.id },
      data: { status: "skipped", swapDecision: SWAP_DECISION.SKIPPED, decidedAt: now },
    });

    // No cash refund (skipCreditRefundOnCancellation off) → bank as store credit.
    let credit = null;
    if (!s.skipCreditRefundOnCancellation && resolvedUserId && contractId) {
      try {
        const billingCycle = billingCycleFor(subscription, shipment);
        const amount = shipment.assignedPrice ?? subscription?.priceUsd ?? 0;
        if (amount > 0) {
          credit = await grantSkipCredit(
            resolvedUserId,
            contractId,
            billingCycle,
            amount,
            `Subscription cancelled mid-window — banked $${amount.toFixed(2)} store credit for cycle ${billingCycle}`,
            {}
          );
          if (!credit.wasAlreadyGranted) credited++;
        }
      } catch (e) {
        logger.error(MODULE, `Cancel credit grant failed for shipment ${shipment.id}: ${e.message}`);
      }
    }

    await recordSwapEvent({
      shipmentId: shipment.id,
      action: SWAP_EVENT_ACTION.SKIP,
      source: SWAP_EVENT_SOURCE.SYSTEM,
      fromProductId,
      toProductId: null,
      note: s.skipCreditRefundOnCancellation
        ? "Subscription cancelled mid-window — not finalized (refund policy on)"
        : credit
          ? credit.wasAlreadyGranted
            ? `Subscription cancelled mid-window — credit already existed (type ${credit.collidedType})`
            : "Subscription cancelled mid-window — banked cycle value as store credit"
          : "Subscription cancelled mid-window — not finalized",
    });
  }

  // Stamp the post-cancellation expiry on the contract's banked skip credits.
  let expiryStamped = 0;
  if (contractId && !s.skipCreditRefundOnCancellation && s.skipCreditPostCancellationDays != null) {
    try {
      const res = await expireSkipCreditsOnCancellation(contractId, s.skipCreditPostCancellationDays, { now });
      expiryStamped = res.stamped;
    } catch (e) {
      logger.error(MODULE, `Post-cancellation credit expiry stamp failed for ${contractId}: ${e.message}`);
    }
  }

  if (held.length) {
    logger.info(MODULE, `Cancel: handled ${held.length} held shipment(s) for subscription ${subscription.id}`, {
      credited,
      expiryStamped,
    });
  }
  return { held: held.length, credited, refunded: !!s.skipCreditRefundOnCancellation, expiryStamped };
}

// ─────────────────────────────────────────────────────────────
// Notifications (FR-19 window opened, FR-20 reminder, FR-21 outcome)
// ─────────────────────────────────────────────────────────────

const SWAP_ACTION_LINK = "/app/cabinet/swap";

/** Resolve the notifiable Cabinet user (id + email + name) for a shipment. */
async function notifyTargetForShipment(shipment) {
  try {
    const customer = await prisma.customer.findUnique({ where: { id: shipment.customerId } });
    if (!customer) return null;
    const { resolveUserIdForCustomer } = await sm();
    const userId = await resolveUserIdForCustomer(customer);
    if (!userId) return null;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, firstName: true, name: true },
    });
    if (!user) return null;
    return { userId: user.id, email: user.email, name: user.firstName || user.name || "Collector" };
  } catch (e) {
    logger.warn(MODULE, `notify target resolution failed for shipment ${shipment.id}: ${e.message}`);
    return null;
  }
}

function fmtDeadline(d) {
  if (!d) return "soon";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "soon";
  }
}

/** FR-19: window opened — what was picked, the deadline, and a link to act. */
export async function notifySwapWindowOpened({ shipment, product, deadline }) {
  const t = await notifyTargetForShipment(shipment);
  if (!t) return null;
  const pick = product?.title || "your next item";
  const by = fmtDeadline(deadline);
  return notify(t.userId, {
    category: "SYSTEM",
    title: "Your next pick is ready — swap or skip by " + by,
    body: `We've selected ${pick} for your subscription. You can keep it, swap it for another eligible item, or skip this cycle for store credit — you have until ${by} to decide, after which ${pick} ships automatically.`,
    linkUrl: SWAP_ACTION_LINK,
    icon: "🎁",
    dedupeKey: `swap_window_opened:${shipment.id}`,
    email: t.email ? { to: t.email, subject: "Your next Luciteria pick — swap or skip by " + by } : null,
  });
}

/** FR-20: pre-deadline reminder if no decision made yet (deduped, at most once). */
export async function notifySwapReminder({ shipment, deadline }) {
  const t = await notifyTargetForShipment(shipment);
  if (!t) return null;
  const by = fmtDeadline(deadline);
  return notify(t.userId, {
    category: "SYSTEM",
    title: "Reminder: your swap/skip window closes " + by,
    body: `You haven't decided on this cycle's pick yet. Swap it, skip it for credit, or do nothing to have it ship as selected. Window closes ${by}.`,
    linkUrl: SWAP_ACTION_LINK,
    icon: "⏰",
    dedupeKey: `swap_window_reminder:${shipment.id}`,
    email: t.email ? { to: t.email, subject: "Reminder: your Luciteria swap window closes " + by } : null,
  });
}

/**
 * FR-21: final outcome — shipped as assigned, shipped as swapped, or skipped.
 * @param {"shipped"|"swapped"|"skipped"} kind
 */
export async function notifySwapOutcome({ shipment, kind, product, creditAmount = null }) {
  const t = await notifyTargetForShipment(shipment);
  if (!t) return null;
  let title, body, icon;
  if (kind === "skipped") {
    icon = "💳";
    title = "Cycle skipped — store credit added";
    body = creditAmount
      ? `You skipped this cycle. $${Number(creditAmount).toFixed(2)} in store credit has been added to your account.`
      : "You skipped this cycle and store credit has been added to your account.";
  } else if (kind === "swapped") {
    icon = "🔄";
    title = "Your swapped pick is on its way";
    body = product?.title
      ? `${product.title} has been finalized and will ship for this cycle.`
      : "Your swapped selection has been finalized and will ship for this cycle.";
  } else {
    icon = "📦";
    title = "Your selection is on its way";
    body = product?.title
      ? `${product.title} has been finalized and will ship for this cycle.`
      : "Your subscription selection has been finalized and will ship for this cycle.";
  }
  return notify(t.userId, {
    category: "SYSTEM",
    title,
    body,
    linkUrl: SWAP_ACTION_LINK,
    icon,
    dedupeKey: `swap_window_outcome:${shipment.id}`,
    email: t.email ? { to: t.email, subject: title } : null,
  });
}

/**
 * Derive the (contract, cycle) billing-cycle key. Mirrors the empty-pool
 * carry-forward derivation so a skip and a carry-forward for the same cycle
 * share one key and cannot violate the type-agnostic DB constraint (FR-12).
 */
function billingCycleFor(subscription, shipment) {
  if (subscription?.nextBillingDate) {
    return new Date(subscription.nextBillingDate).toISOString().slice(0, 7);
  }
  const base = shipment?.shipmentDate || new Date();
  return new Date(base).toISOString().slice(0, 7);
}

export { placeOrderForHeldShipment, billingCycleFor };
