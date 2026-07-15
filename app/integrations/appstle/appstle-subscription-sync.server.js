/**
 * Luciteria Collector Cabinet — Appstle → DB Subscription Sync
 *
 * Creates / updates the Cabinet `Subscription` record from a normalized
 * Appstle webhook payload, and ensures a matching `SubscriptionTier` row
 * exists (seeded from config on first sight).
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §5 & §6.
 */

import { prisma } from "../../lib/db.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { calculateNextBillingDate } from "../../lib/billing.server.js";
import {
  getTierByCollectionType,
  resolveTierKey,
} from "../../config/subscription-tiers.server.js";

const MODULE = "appstle-subscription-sync";

/**
 * Map a normalized Appstle billing interval to the Cabinet's billingCadence.
 * @param {string} interval
 * @param {number} count
 * @returns {string}
 */
function mapBillingCadence(interval, count = 1) {
  const i = (interval || "MONTH").toUpperCase();
  if (i === "WEEK") return count >= 4 ? "monthly" : "weekly";
  if (i === "MONTH") return count >= 12 ? "annual" : count >= 3 ? "quarterly" : "monthly";
  if (i === "YEAR") return "annual";
  return "monthly";
}

/**
 * Ensure a SubscriptionTier row exists for this payload's collection type.
 * Seeds from the config constants on first sight; updates the Appstle selling
 * plan id if newly learned.
 *
 * @param {import('./appstle-types.js').NormalizedAppstlePayload} payload
 * @returns {Promise<Object|null>} the SubscriptionTier record
 */
export async function ensureSubscriptionTier(payload) {
  const tierKey = resolveTierKey(payload);
  if (!tierKey) return null;

  const cfg = getTierByCollectionType(payload.collectionType);
  const sellingPlanId = payload.sellingPlanId || null;

  try {
    const existing = await prisma.subscriptionTier.findUnique({ where: { name: tierKey } });
    if (existing) {
      if (sellingPlanId && !existing.appstleSellingPlanId) {
        return prisma.subscriptionTier.update({
          where: { id: existing.id },
          data: { appstleSellingPlanId: sellingPlanId },
        });
      }
      return existing;
    }

    return await prisma.subscriptionTier.create({
      data: {
        name: cfg.name,
        displayName: payload.sellingPlanName || cfg.displayName,
        collectionType: cfg.collectionType,
        appstleSellingPlanId: sellingPlanId,
        monthlyPrice: payload.price ?? cfg.monthlyPrice,
        billingInterval: payload.billingInterval || cfg.billingInterval,
        billingIntervalCount: payload.billingIntervalCount || cfg.billingIntervalCount,
        excludePreciousMetals: cfg.excludePreciousMetals,
        maxDiscountPercent: cfg.maxDiscountPercent,
        itemsPerShipment: cfg.itemsPerShipment,
        defaultStrategy: cfg.defaultStrategy,
        allowDuplicates: cfg.allowDuplicates,
        sortOrder: cfg.sortOrder,
      },
    });
  } catch (err) {
    // Non-fatal: tier seeding is best-effort (unique clashes on selling plan id, etc.)
    logger.warn(MODULE, `ensureSubscriptionTier failed for ${tierKey}: ${err.message}`);
    return null;
  }
}

/**
 * Create or update the Cabinet Subscription for a resolved customer.
 *
 * @param {Object} params
 * @param {Object} params.customer - Cabinet Customer record
 * @param {import('./appstle-types.js').NormalizedAppstlePayload} params.payload
 * @param {boolean} [params.isNew] - hint that this is a subscription/created event
 * @returns {Promise<Object>} the Subscription record
 */
export async function syncSubscription({ customer, payload, isNew = false }) {
  const cfg = getTierByCollectionType(payload.collectionType);
  const now = new Date();

  const price = payload.price ?? cfg.monthlyPrice;
  const collectionType = payload.collectionType || customer.collectionType || "lucite";
  const status = payload.status || "active";
  const nextBillingDate =
    payload.nextBillingDate || calculateNextBillingDate(now, now);

  // Try to locate an existing subscription — by Appstle contract id, then by customer.
  let subscription = null;
  if (payload.subscriptionContractId) {
    subscription = await prisma.subscription.findUnique({
      where: { appstleContractId: payload.subscriptionContractId },
    });
  }
  if (!subscription) {
    subscription = await prisma.subscription.findUnique({
      where: { customerId: customer.id },
    });
  }

  if (subscription) {
    const data = {
      status,
      collectionType,
      priceUsd: price,
      nextBillingDate,
      planName: payload.sellingPlanName || subscription.planName,
      planTier: resolveTierKey(payload) || subscription.planTier,
    };
    if (payload.subscriptionContractId && !subscription.appstleContractId) {
      data.appstleContractId = payload.subscriptionContractId;
    }
    if (payload.shopifyContractId && !subscription.shopifyContractId) {
      data.shopifyContractId = payload.shopifyContractId;
    }
    if (payload.sellingPlanId) data.appstleSellingPlanId = payload.sellingPlanId;
    if (payload.sellingPlanName) data.appstleSellingPlanName = payload.sellingPlanName;

    subscription = await prisma.subscription.update({
      where: { id: subscription.id },
      data,
    });
    logger.info(MODULE, `Updated subscription ${subscription.id}`, {
      status,
      collectionType,
    });
    return subscription;
  }

  // Create a fresh subscription record.
  const startDate = payload.createdAt || now;
  subscription = await prisma.subscription.create({
    data: {
      customerId: customer.id,
      appstleContractId: payload.subscriptionContractId || null,
      shopifyContractId: payload.shopifyContractId || null,
      appstleSellingPlanId: payload.sellingPlanId || null,
      appstleSellingPlanName: payload.sellingPlanName || null,
      planName: payload.sellingPlanName || cfg.displayName,
      planTier: resolveTierKey(payload) || cfg.name,
      status,
      billingCadence: mapBillingCadence(payload.billingInterval, payload.billingIntervalCount),
      priceUsd: price,
      collectionType,
      originalPrice: price,
      currentPrice: price,
      priceLockedAt: startDate,
      grandfathered: true,
      // First shipment is immediate; next billing comes from Appstle.
      nextShipmentDate: now,
      nextBillingDate,
      startDate,
      itemsPerShipment: cfg.itemsPerShipment,
    },
  });

  // Keep the Customer's collection type aligned with the plan.
  if (customer.collectionType !== collectionType) {
    await prisma.customer.update({
      where: { id: customer.id },
      data: { collectionType },
    });
  }

  logger.info(MODULE, `Created subscription ${subscription.id}`, {
    customerEmail: customer.email,
    collectionType,
    contract: payload.subscriptionContractId,
  });
  return subscription;
}

/**
 * Record a billing event in the ledger + update subscription billing metadata.
 *
 * @param {Object} params
 * @param {Object} params.subscription
 * @param {Object} params.customer
 * @param {import('./appstle-types.js').NormalizedAppstlePayload} params.payload
 * @param {"charge_success"|"charge_failed"|"refund"} params.eventType
 * @returns {Promise<Object>} the BillingEvent record
 */
export async function recordBillingEvent({ subscription, customer, payload, eventType }) {
  const amount = payload.amountCharged ?? payload.price ?? subscription.priceUsd ?? 0;
  const billingDate = payload.billingDate || new Date();

  // Idempotent-ish on appstleBillingId (unique). Skip duplicates gracefully.
  if (payload.billingAttemptId) {
    const existing = await prisma.billingEvent.findUnique({
      where: { appstleBillingId: payload.billingAttemptId },
    });
    if (existing) {
      logger.info(MODULE, `Billing event ${payload.billingAttemptId} already recorded`);
      return existing;
    }
  }

  const event = await prisma.billingEvent.create({
    data: {
      subscriptionId: subscription.id,
      customerId: customer.id,
      appstleBillingId: payload.billingAttemptId || null,
      shopifyOrderId: payload.orderId ? String(payload.orderId) : null,
      eventType,
      amount,
      currency: payload.currency || "USD",
      billingDate,
      nextBillingDate: payload.nextBillingDate || null,
      metadata: JSON.stringify({
        orderNumber: payload.orderNumber || null,
        rawStatus: payload.rawStatus || null,
      }),
    },
  });

  // Update subscription billing bookkeeping.
  if (eventType === "charge_success") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        lastBillingDate: billingDate,
        lastBillingAmount: amount,
        failedBillingAttempts: 0,
        status: "active",
        nextBillingDate: payload.nextBillingDate || subscription.nextBillingDate,
      },
    });
  } else if (eventType === "charge_failed") {
    await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        failedBillingAttempts: { increment: 1 },
        status: "past_due",
      },
    });
  }

  return event;
}
