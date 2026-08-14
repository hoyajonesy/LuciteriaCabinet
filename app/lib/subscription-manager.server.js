/**
 * Luciteria Collector Cabinet — Subscription Manager
 *
 * Orchestrates the flow that runs after a subscription event:
 *   1. Load assignment context from the DB (products, owned/shipped/wishlist ids, prefs)
 *   2. Run the existing assignment engine to pick the next product
 *   3. Create a SubscriptionShipment record
 *   4. Auto-approve → create Shopify draft order, OR route to the admin exception queue
 *   5. Refresh the AssignmentPreview sequence
 *
 * This is the bridge between the Seal webhook handlers and the existing
 * assignment-engine / Shopify integrations.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §5.1 (handleBillingSuccess) & §8 (first shipment).
 */

import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";
import {
  assignNextItem,
  previewSequence,
  STRATEGIES,
} from "./assignment-engine.server.js";
import { createSubscriptionDraftOrder } from "../integrations/seal/seal-draft-orders.server.js";
import { getTierByCollectionType } from "./subscription-tiers-db.server.js";
import { getFeatureFlag } from "./feature-flags.server.js";
import { resolveAssignmentGate, GATE_MODE, handleEmptyPool } from "./subscription-onboarding.server.js";
import { canonicalFormatFromSku } from "./seed-order-history.server.js";
import { normaliseFormat } from "./formats.js";

const MODULE = "subscription-manager";

/**
 * Resolve the Cabinet userId for a customer (linked by email — see
 * customer-resolver.server.js). Returns null if none found.
 */
async function resolveUserIdForCustomer(customer) {
  if (!customer?.email) return null;
  const user = await prisma.user.findUnique({
    where: { email: customer.email },
    select: { id: true },
  });
  return user?.id || null;
}

/**
 * Compute the extra product ids to exclude from assignment based on the user's
 * confirmed-owned CollectionItems (FR-15 NORMAL / BACKSTOP_ONLY exclusions).
 *
 * A product is excluded when its element + canonical SKU format matches a
 * CollectionItem that is OWNED and not rejected. In BACKSTOP_ONLY mode we only
 * trust subscriberConfirmed items; unconfirmed order-history suggestions are
 * NOT excluded (we would rather risk a duplicate than skip an owed item).
 */
async function computeOnboardingExclusions(userId, allProducts, { confirmedOnly }) {
  if (!userId) return [];

  const owned = await prisma.collectionItem.findMany({
    where: {
      userId,
      state: "OWNED",
      rejectedBySubscriber: false,
      ...(confirmedOnly ? { subscriberConfirmed: true } : {}),
    },
    select: { elementSymbol: true, format: true },
  });

  if (owned.length === 0) return [];

  // Build a lookup set of "symbol|canonicalFormat" for owned items.
  const ownedKeys = new Set(
    owned.map((o) => `${o.elementSymbol.toLowerCase()}|${o.format ? normaliseFormat(o.format) : "null"}`)
  );

  const excludedIds = [];
  for (const p of allProducts) {
    if (!p.elementSymbol || !p.sku) continue;
    const canonicalFmt = canonicalFormatFromSku(p.sku);
    const key = `${p.elementSymbol.toLowerCase()}|${canonicalFmt ? normaliseFormat(canonicalFmt) : "null"}`;
    if (ownedKeys.has(key)) excludedIds.push(p.id);
  }
  return excludedIds;
}

/** Parse a JSON string field into an array, tolerating bad data. */
function parseArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const v = JSON.parse(value || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

/**
 * Load everything the assignment engine needs for a given customer.
 *
 * @param {Object} customer - Cabinet Customer record
 * @returns {Promise<Object>} assignment context
 */
export async function loadAssignmentContext(customer) {
  const [allProductsRaw, ownedRecords, shipmentItems, wishlist, preferences] =
    await Promise.all([
      prisma.product.findMany({
        where: { status: "Active" },
      }),
      prisma.collectionRecord.findMany({
        where: { customerId: customer.id },
        select: { productId: true },
      }),
      prisma.shipmentItem.findMany({
        where: { shipment: { customerId: customer.id } },
        select: { productId: true },
      }),
      prisma.wishlistItem.findMany({
        where: { customerId: customer.id },
        select: { productId: true },
      }),
      prisma.customerPreference.findUnique({ where: { customerId: customer.id } }),
    ]);

  // The assignment engine expects collectionTypes as an array.
  const allProducts = allProductsRaw.map((p) => ({
    ...p,
    collectionTypes: parseArray(p.collectionTypes),
  }));

  return {
    allProducts,
    ownedProductIds: ownedRecords.map((r) => r.productId),
    shippedProductIds: shipmentItems.map((r) => r.productId),
    wishlistProductIds: wishlist.map((r) => r.productId),
    preferences: preferences || {},
  };
}

/**
 * Run the assignment engine for a customer/subscription.
 *
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Object} params.subscription
 * @param {boolean} [params.isFirstShipment]
 * @param {string} [params.manualOverrideProductId]
 * @returns {Promise<Object>} assignment engine result (+ context)
 */
export async function runAssignment({
  customer,
  subscription,
  isFirstShipment = false,
  manualOverrideProductId = null,
}) {
  const ctx = await loadAssignmentContext(customer);
  const collectionType = subscription?.collectionType || customer.collectionType || "lucite";
  const tier = await getTierByCollectionType(collectionType);

  // First shipment: no wishlist/history yet → fall back to OLDEST_MISSING.
  let strategy = STRATEGIES.WISHLIST_PRIORITY;
  if (ctx.preferences?.duplicateHandling === "surprise") {
    strategy = STRATEGIES.SURPRISE;
  } else if (isFirstShipment && ctx.wishlistProductIds.length === 0) {
    strategy = STRATEGIES.OLDEST_MISSING;
  }

  // ─── Subscription-onboarding exclusions (FR-15) ───
  // When the onboarding gate is enabled, exclude products the subscriber has
  // told us (or we inferred) they already own, so we never ship a duplicate.
  let ownedProductIds = ctx.ownedProductIds;
  try {
    const gateEnabled = await getFeatureFlag("feature_subscription_onboarding_gate");
    if (gateEnabled) {
      const contractId = subscription?.appstleContractId || subscription?.shopifyContractId || null;
      const userId = await resolveUserIdForCustomer(customer);
      const gate = await resolveAssignmentGate({ userId, contractId, isFirstShipment });
      // NORMAL trusts all owned (confirmed + suggested); BACKSTOP_ONLY trusts
      // only subscriber-confirmed items.
      const confirmedOnly = gate.mode === GATE_MODE.BACKSTOP_ONLY;
      const extra = await computeOnboardingExclusions(userId, ctx.allProducts, { confirmedOnly });
      if (extra.length > 0) {
        ownedProductIds = Array.from(new Set([...ownedProductIds, ...extra]));
        logger.info(MODULE, `Onboarding exclusions applied (${gate.mode})`, {
          extra: extra.length,
          confirmedOnly,
        });
      }
    }
  } catch (e) {
    logger.warn(MODULE, `Onboarding exclusion computation failed: ${e.message}`);
  }

  const result = assignNextItem({
    customer: { ...customer, collectionType },
    ownedProductIds,
    shippedProductIds: ctx.shippedProductIds,
    preferences: ctx.preferences,
    wishlistProductIds: ctx.wishlistProductIds,
    allProducts: ctx.allProducts,
    strategy,
    collectionType,
    subscriptionPrice: subscription?.priceUsd || tier.monthlyPrice,
    manualOverrideProductId,
    tier,
  });

  // Persist the audit trail so admins can see exactly why the engine chose (or
  // could not choose) an item for this customer/cycle.
  logger.info(MODULE, `Assignment for ${customer.email || customer.id} (${collectionType})`, {
    success: result.success,
    assigned: result.product?.sku || null,
    reason: result.reason,
    isFirstShipment,
    audit: result.audit,
  });

  return { ...result, context: ctx, strategy, collectionType, tier };
}

/**
 * Full pipeline: create a shipment, run assignment, and either create a draft
 * order (auto-approve) or open an admin exception.
 *
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Object} params.subscription
 * @param {boolean} [params.isFirstShipment]
 * @param {number} [params.assignedPrice] - Price customer paid (defaults to sub price)
 * @returns {Promise<Object>} { shipment, assignment, draftOrder, exception }
 */
export async function processShipmentAssignment({
  customer,
  subscription,
  isFirstShipment = false,
  assignedPrice = null,
}) {
  const price = assignedPrice ?? subscription.priceUsd ?? 0;

  // ─── Onboarding gate (FR-15) ───
  // For renewal shipments (not the first), hold assignment while the subscriber
  // is still within the onboarding grace window and hasn't completed. The first
  // shipment is the bounded fulfillment promise and always proceeds (FR-13).
  if (!isFirstShipment) {
    try {
      const gateEnabled = await getFeatureFlag("feature_subscription_onboarding_gate");
      if (gateEnabled) {
        const contractId = subscription?.appstleContractId || subscription?.shopifyContractId || null;
        const userId = await resolveUserIdForCustomer(customer);
        const gate = await resolveAssignmentGate({ userId, contractId, isFirstShipment });
        if (gate.mode === GATE_MODE.BLOCKED) {
          logger.info(MODULE, `Assignment BLOCKED pending onboarding for contract ${contractId}`);
          return {
            shipment: null,
            assignment: null,
            draftOrder: null,
            exception: null,
            blocked: true,
            gateMode: gate.mode,
          };
        }
      }
    } catch (e) {
      // Fail open — never block fulfillment because of a gate error.
      logger.warn(MODULE, `Onboarding gate check failed (proceeding): ${e.message}`);
    }
  }

  // 1. Create the shipment shell (status: scheduled).
  const shipment = await prisma.subscriptionShipment.create({
    data: {
      subscriptionId: subscription.id,
      customerId: customer.id,
      shipmentDate: new Date(),
      status: "scheduled",
      assignedPrice: price,
      assignedBy: "auto",
      notes: isFirstShipment ? "First subscription shipment" : "Monthly renewal",
    },
  });

  // 2. Run the assignment engine.
  const assignment = await runAssignment({ customer, subscription, isFirstShipment });

  // 3a. No eligible product → exception + leave shipment scheduled.
  if (!assignment.success || !assignment.product) {
    const exception = await openException({
      customer,
      reason: assignment.exception?.reason || "no_eligible_items",
      details:
        assignment.exception?.details ||
        assignment.reason ||
        "Assignment engine returned no product",
    });
    await notifyAdmins(
      "Subscription assignment needs attention",
      `No product could be auto-assigned for ${customer.firstName} ${customer.lastName} (${assignment.collectionType}). Reason: ${assignment.reason}`
    );

    // ─── Empty pool handling (FR-14/17/20/21) ───
    // If the assignment failed because there are no eligible items (the pool is
    // empty) AND this is a renewal (not first shipment) AND the onboarding
    // feature is enabled, grant a carry-forward credit to the subscriber.
    if (
      !isFirstShipment &&
      assignment.exception?.reason === "no_eligible_items"
    ) {
      try {
        const gateEnabled = await getFeatureFlag("feature_subscription_onboarding_gate");
        if (gateEnabled) {
          const userId = await resolveUserIdForCustomer(customer);
          const contractId = subscription?.appstleContractId || subscription?.shopifyContractId || null;
          if (userId && contractId) {
            const billingCycle = subscription.nextBillingDate
              ? new Date(subscription.nextBillingDate).toISOString().slice(0, 7) // "2026-08"
              : new Date().toISOString().slice(0, 7);
            const creditAmount = subscription.priceUsd || price || 0;
            const formatTrack = assignment.collectionType || subscription.collectionType || customer.collectionType || "unknown";
            const cabinetUrl = process.env.CABINET_URL || "https://luciteriacabinet.com/app/cabinet";

            await handleEmptyPool({
              userId,
              subscriptionContractId: contractId,
              billingCycle,
              creditAmount,
              formatTrack,
              cabinetUrl,
            });

            logger.info(MODULE, `Empty pool credit granted for ${customer.email} (${formatTrack}, cycle ${billingCycle})`);
          }
        }
      } catch (e) {
        // Fail open — never block the exception queue because of empty-pool handling.
        logger.warn(MODULE, `Empty pool handling failed (exception still queued): ${e.message}`);
      }
    }

    return { shipment, assignment, draftOrder: null, exception };
  }

  const product = assignment.product;
  const retailPrice = product.retailPrice || product.priceUsd || 0;
  const discountPercent = assignment.discount
    ? Math.round(assignment.discount.discountPct * 10000) / 100
    : 0;

  // 4. Link the assigned product to the shipment.
  await prisma.shipmentItem.create({
    data: { shipmentId: shipment.id, productId: product.id },
  });

  await prisma.subscriptionShipment.update({
    where: { id: shipment.id },
    data: {
      status: "assigned",
      retailPrice,
      discountPercent,
    },
  });

  // 3b. Requires manual review → exception, do NOT auto-create the order.
  if (assignment.requiresManualReview) {
    const exception = await openException({
      customer,
      reason: assignment.exception?.reason || "high_discount",
      details:
        assignment.exception?.details ||
        `Review recommended for ${product.title}. Flags: ${(assignment.flags || []).join(", ")}`,
    });
    await notifyAdmins(
      isFirstShipment ? "First shipment awaiting review" : "Subscription shipment awaiting review",
      `${customer.firstName} ${customer.lastName}: assigned ${product.title} (${discountPercent}% discount). Flags: ${(assignment.flags || []).join(", ")}.`
    );

    const freshShipment = await prisma.subscriptionShipment.findUnique({
      where: { id: shipment.id },
    });
    return { shipment: freshShipment, assignment, draftOrder: null, exception };
  }

  // 5. Auto-approved → create the Shopify draft order.
  let draftOrder = null;
  try {
    draftOrder = await createSubscriptionDraftOrder({
      customer,
      product,
      shipment,
      assignedPrice: price,
      isFirstShipment,
    });
  } catch (err) {
    logger.error(MODULE, `Draft order creation failed for shipment ${shipment.id}`, err);
    await openException({
      customer,
      reason: "inventory_conflict",
      details: `Draft order creation failed for ${product.title}: ${err.message}`,
    });
  }

  // 6. Refresh the pre-computed assignment preview sequence.
  try {
    await refreshAssignmentPreview({ customer, subscription });
  } catch (err) {
    logger.warn(MODULE, `Assignment preview refresh failed: ${err.message}`);
  }

  const freshShipment = await prisma.subscriptionShipment.findUnique({
    where: { id: shipment.id },
  });

  return { shipment: freshShipment, assignment, draftOrder, exception: null };
}

/**
 * Recompute and persist the AssignmentPreview sequence for a subscription.
 *
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Object} params.subscription
 * @param {number} [params.count]
 * @returns {Promise<number>} number of preview rows written
 */
export async function refreshAssignmentPreview({ customer, subscription, count = 4 }) {
  const ctx = await loadAssignmentContext(customer);
  const collectionType = subscription?.collectionType || customer.collectionType || "lucite";
  const tier = await getTierByCollectionType(collectionType);

  const sequence = previewSequence({
    customer: { ...customer, collectionType },
    ownedProductIds: ctx.ownedProductIds,
    shippedProductIds: ctx.shippedProductIds,
    preferences: ctx.preferences,
    wishlistProductIds: ctx.wishlistProductIds,
    allProducts: ctx.allProducts,
    strategy: STRATEGIES.WISHLIST_PRIORITY,
    collectionType,
    subscriptionPrice: subscription?.priceUsd || tier.monthlyPrice,
    tier,
    count,
  });

  // Replace existing previews for this subscription.
  await prisma.assignmentPreview.deleteMany({
    where: { subscriptionId: subscription.id },
  });

  let written = 0;
  const base = subscription.nextBillingDate || new Date();
  for (const entry of sequence) {
    const estimatedDate = new Date(base);
    estimatedDate.setMonth(estimatedDate.getMonth() + (entry.month - 1));

    await prisma.assignmentPreview.create({
      data: {
        subscriptionId: subscription.id,
        customerId: customer.id,
        sequencePosition: entry.month,
        productId: entry.product?.id || null,
        productSku: entry.product?.sku || null,
        productTitle: entry.product?.title || null,
        estimatedDate,
        estimatedDiscount: entry.discount ? entry.discount.discountPct : null,
        status: "preview",
      },
    });
    written += 1;
  }

  return written;
}

/**
 * Create an AssignmentException row (admin exception queue).
 * @param {Object} params
 * @param {Object} params.customer
 * @param {string} params.reason
 * @param {string} params.details
 * @returns {Promise<Object>}
 */
export async function openException({ customer, reason, details }) {
  return prisma.assignmentException.create({
    data: {
      customerId: customer.id,
      reason,
      details,
      status: "pending",
    },
  });
}

/**
 * Admin preview data: upcoming pre-computed assignments plus any shipments that
 * are currently awaiting manual review. Powers the admin preview/override UI.
 *
 * @param {Object} [params]
 * @param {number} [params.limit]
 * @returns {Promise<{ previews: Array, pendingReview: Array }>}
 */
export async function getUpcomingAssignments({ limit = 100 } = {}) {
  const [previews, pendingReview] = await Promise.all([
    prisma.assignmentPreview.findMany({
      orderBy: [{ estimatedDate: "asc" }, { sequencePosition: "asc" }],
      take: limit,
    }),
    prisma.subscriptionShipment.findMany({
      where: { status: { in: ["scheduled", "assigned"] } },
      include: { items: { include: { product: true } } },
      orderBy: { shipmentDate: "asc" },
      take: limit,
    }),
  ]);

  // Enrich pending shipments with customer + subscription context.
  const enriched = await Promise.all(
    pendingReview.map(async (s) => {
      const [customer, subscription] = await Promise.all([
        prisma.customer.findUnique({ where: { id: s.customerId } }),
        prisma.subscription.findUnique({ where: { id: s.subscriptionId } }),
      ]);
      return { ...s, customer, subscription };
    })
  );

  return { previews, pendingReview: enriched };
}

/**
 * Apply a manual admin override: swap the product assigned to a shipment.
 *
 * Validates the target product through the assignment engine's override path
 * (so discount/eligibility metadata is recomputed), swaps the shipment item,
 * records an audit log, refreshes the preview sequence, and — unless a draft
 * order already exists — creates the Shopify draft order for the new product.
 *
 * @param {Object} params
 * @param {string} params.shipmentId
 * @param {string} params.newProductId
 * @param {string} [params.adminEmail]
 * @param {string} [params.reason]
 * @param {boolean} [params.createDraft]
 * @returns {Promise<Object>} { shipment, product, previousProduct, overrideLog, assignment, draftOrder }
 */
export async function applyManualOverride({
  shipmentId,
  newProductId,
  adminEmail = "admin",
  reason = null,
  createDraft = true,
}) {
  const shipment = await prisma.subscriptionShipment.findUnique({
    where: { id: shipmentId },
    include: { items: true },
  });
  if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);

  const [subscription, customer] = await Promise.all([
    prisma.subscription.findUnique({ where: { id: shipment.subscriptionId } }),
    prisma.customer.findUnique({ where: { id: shipment.customerId } }),
  ]);
  if (!subscription || !customer) {
    throw new Error(`Missing subscription/customer for shipment ${shipmentId}`);
  }

  // Validate the target product through the engine override path.
  const assignment = await runAssignment({
    customer,
    subscription,
    manualOverrideProductId: newProductId,
  });
  if (!assignment.success || !assignment.product) {
    throw new Error(`Override product invalid: ${assignment.reason}`);
  }
  const product = assignment.product;

  // Capture previous product for the audit log.
  const prevItem = shipment.items[0];
  const previousProduct = prevItem
    ? await prisma.product.findUnique({ where: { id: prevItem.productId } })
    : null;

  // Swap the shipment item.
  await prisma.shipmentItem.deleteMany({ where: { shipmentId } });
  await prisma.shipmentItem.create({ data: { shipmentId, productId: product.id } });

  const retailPrice = product.retailPrice || product.priceUsd || 0;
  const discountPercent = assignment.discount
    ? Math.round(assignment.discount.discountPct * 10000) / 100
    : 0;

  await prisma.subscriptionShipment.update({
    where: { id: shipmentId },
    data: {
      status: "assigned",
      retailPrice,
      discountPercent,
      assignedBy: adminEmail,
      notes: `${shipment.notes || ""}\n[override ${new Date().toISOString()}] ${adminEmail} → ${product.sku}${reason ? ` (${reason})` : ""}`.trim(),
    },
  });

  // Record the override in the exception/audit queue (resolved).
  const overrideLog = await prisma.assignmentException.create({
    data: {
      customerId: customer.id,
      reason: "manual_override",
      details: `Admin ${adminEmail} swapped ${previousProduct?.sku || "none"} → ${product.sku} on shipment ${shipmentId}. Reason: ${reason || "not specified"}`,
      status: "resolved",
      resolvedBy: adminEmail,
      resolvedAt: new Date(),
      resolution: `Overridden to ${product.sku} (${product.elementSymbol})`,
    },
  });

  // Reflect the change in the preview sequence (position 1 = this shipment).
  await prisma.assignmentPreview
    .updateMany({
      where: { subscriptionId: subscription.id, sequencePosition: 1 },
      data: {
        status: "shifted",
        shiftedReason: "admin_override",
        productId: product.id,
        productSku: product.sku,
        productTitle: product.title,
        estimatedDiscount: assignment.discount?.discountPct ?? null,
      },
    })
    .catch((e) => logger.warn(MODULE, `preview update on override failed: ${e.message}`));

  // Create the Shopify draft order for the new product (unless one exists).
  let draftOrder = null;
  if (createDraft && !shipment.shopifyDraftOrderId) {
    try {
      draftOrder = await createSubscriptionDraftOrder({
        customer,
        product,
        shipment,
        assignedPrice: shipment.assignedPrice ?? subscription.priceUsd,
        isFirstShipment: /first/i.test(shipment.notes || ""),
      });
    } catch (err) {
      logger.error(MODULE, `Draft order creation failed after override for ${shipmentId}`, err);
    }
  }

  await notifyAdmins(
    "Manual assignment override applied",
    `${adminEmail} overrode shipment ${shipmentId} for ${customer.firstName} ${customer.lastName}: ${previousProduct?.title || "unassigned"} → ${product.title}.`
  );

  const freshShipment = await prisma.subscriptionShipment.findUnique({ where: { id: shipmentId } });
  return { shipment: freshShipment, product, previousProduct, overrideLog, assignment, draftOrder };
}

/**
 * Notify all staff users via the in-app notification system (best-effort).
 * @param {string} title
 * @param {string} body
 */
export async function notifyAdmins(title, body) {
  try {
    const { notify } = await import("./notifications-db.server.js");
    const staff = await prisma.user.findMany({ where: { isStaff: true } });
    for (const s of staff) {
      await notify(s.id, {
        category: "ADMIN",
        title,
        body,
        linkUrl: "/app/admin/operations",
        icon: "📦",
      });
    }
  } catch (err) {
    logger.warn(MODULE, `notifyAdmins failed: ${err.message}`);
  }
}
