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
import { grantSkipCredit } from "./credits.server.js";

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

  return { ok: true, finalized: true, credit, reason: null };
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
