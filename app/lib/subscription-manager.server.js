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
 * This is the bridge between the Appstle webhook handlers and the existing
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
import { createSubscriptionDraftOrder } from "../integrations/appstle/appstle-draft-orders.server.js";
import { getTierByCollectionType } from "../config/subscription-tiers.server.js";

const MODULE = "subscription-manager";

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
  const tier = getTierByCollectionType(collectionType);

  // First shipment: no wishlist/history yet → fall back to OLDEST_MISSING.
  let strategy = STRATEGIES.WISHLIST_PRIORITY;
  if (ctx.preferences?.duplicateHandling === "surprise") {
    strategy = STRATEGIES.SURPRISE;
  } else if (isFirstShipment && ctx.wishlistProductIds.length === 0) {
    strategy = STRATEGIES.OLDEST_MISSING;
  }

  const result = assignNextItem({
    customer: { ...customer, collectionType },
    ownedProductIds: ctx.ownedProductIds,
    shippedProductIds: ctx.shippedProductIds,
    preferences: ctx.preferences,
    wishlistProductIds: ctx.wishlistProductIds,
    allProducts: ctx.allProducts,
    strategy,
    collectionType,
    subscriptionPrice: subscription?.priceUsd || tier.monthlyPrice,
    manualOverrideProductId,
  });

  return { ...result, context: ctx, strategy, collectionType };
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
  const tier = getTierByCollectionType(collectionType);

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
