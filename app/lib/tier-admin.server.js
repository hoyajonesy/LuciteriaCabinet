/**
 * Luciteria Collector Cabinet — Subscription Tier Admin Service
 *
 * Server-side helpers backing the tier-management admin UI
 * (`/app/admin/subscription-tiers`). This layer sits on top of the
 * database-backed tier service (`subscription-tiers-db.server.js`) and adds the
 * admin-only concerns the UI needs:
 *
 *   - listing ALL tiers (active + inactive), which the cached public service
 *     intentionally hides;
 *   - counting how many live subscribers / eligible products a tier touches,
 *     so the UI can warn before destructive or pricing changes;
 *   - safe delete / activate-deactivate with guard rails;
 *   - an audit trail for every tier change (who, what, before → after).
 *
 * All writes funnel through `upsertTier` in the DB service so validation and
 * cache invalidation stay in one place.
 */

import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";
import {
  getAllTiers,
  upsertTier,
  invalidateTierCache,
  validateTierConfig,
} from "./subscription-tiers-db.server.js";

const MODULE = "tier-admin";

/** Statuses that count as a "live" subscriber for safety warnings. */
const LIVE_SUBSCRIPTION_STATUSES = ["active", "paused", "past_due"];

/** Collection types the UI is allowed to offer (mirrors the DB validator). */
export const COLLECTION_TYPE_OPTIONS = [
  { value: "10mm", label: "10mm Cubes" },
  { value: "25.4mm", label: "25.4mm (1 inch) Cubes" },
  { value: "50mm", label: "50mm Cubes" },
  { value: "lucite", label: "Lucite Blocks" },
  { value: "ampoules", label: "Ampoules" },
  { value: "ampule", label: "Ampules (single)" },
];

/** Assignment strategies offered in the form. */
export const STRATEGY_OPTIONS = [
  { value: "wishlist_priority", label: "Wishlist priority" },
  { value: "oldest_missing", label: "Oldest missing element" },
  { value: "surprise", label: "Surprise me" },
  { value: "sequential", label: "Sequential (atomic order)" },
  { value: "manual", label: "Manual only" },
];

// ─── Reads ───────────────────────────────────────────────────

/**
 * Count live subscribers attached to a tier. Matches on the tier key
 * (`planTier`), then falls back to selling-plan id and collection type so we
 * don't under-report subscribers linked by a different key.
 *
 * @param {{ name?: string, appstleSellingPlanId?: string|null, shopifySellingPlanId?: string|null, collectionType?: string|null }} tier
 * @returns {Promise<number>}
 */
export async function countActiveSubscribers(tier) {
  if (!tier) return 0;
  const or = [];
  if (tier.name) or.push({ planTier: tier.name });
  if (tier.appstleSellingPlanId) or.push({ appstleSellingPlanId: tier.appstleSellingPlanId });
  if (tier.shopifySellingPlanId) or.push({ appstleSellingPlanId: tier.shopifySellingPlanId });
  if (tier.collectionType) or.push({ collectionType: tier.collectionType });
  if (or.length === 0) return 0;

  try {
    return await prisma.subscription.count({
      where: { status: { in: LIVE_SUBSCRIPTION_STATUSES }, OR: or },
    });
  } catch (err) {
    logger.warn(MODULE, `subscriber count failed: ${err.message}`);
    return 0;
  }
}

/**
 * Count active, in-stock products eligible for a tier's collection types.
 * Used to show admins how large the assignable pool is for a tier.
 *
 * @param {string[]} collectionTypes
 * @returns {Promise<number>}
 */
export async function countEligibleProducts(collectionTypes = []) {
  const types = (collectionTypes || []).filter(Boolean);
  if (types.length === 0) return 0;
  try {
    const products = await prisma.product.findMany({
      where: { status: "Active", inventoryQty: { gt: 0 } },
      select: { collectionTypes: true },
    });
    return products.filter((p) => {
      let list = [];
      try {
        list = Array.isArray(p.collectionTypes) ? p.collectionTypes : JSON.parse(p.collectionTypes || "[]");
      } catch {
        list = [];
      }
      return list.some((ct) => types.includes(ct));
    }).length;
  } catch (err) {
    logger.warn(MODULE, `eligible product count failed: ${err.message}`);
    return 0;
  }
}

/**
 * List every tier (active AND inactive) for the admin list view, enriched with
 * the live subscriber count. Ordered by displayOrder then name.
 *
 * @returns {Promise<Object[]>}
 */
export async function listAllTiersForAdmin() {
  const rows = await prisma.subscriptionTier.findMany({
    orderBy: [{ displayOrder: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
  });

  return Promise.all(
    rows.map(async (t) => ({
      ...t,
      activeSubscribers: await countActiveSubscribers(t),
    })),
  );
}

/**
 * Fetch a single tier by id for the edit form, plus its impact counts.
 * Returns `null` when the id is unknown.
 *
 * @param {string} tierId
 * @returns {Promise<{tier: Object, activeSubscribers: number, eligibleProducts: number}|null>}
 */
export async function getTierForAdmin(tierId) {
  if (!tierId || tierId === "new") return null;
  const tier = await prisma.subscriptionTier.findUnique({ where: { id: tierId } });
  if (!tier) return null;
  const collectionTypes =
    Array.isArray(tier.allowedCollectionTypes) && tier.allowedCollectionTypes.length > 0
      ? tier.allowedCollectionTypes
      : tier.collectionType
        ? [tier.collectionType]
        : [];
  const [activeSubscribers, eligibleProducts] = await Promise.all([
    countActiveSubscribers(tier),
    countEligibleProducts(collectionTypes),
  ]);
  return { tier, activeSubscribers, eligibleProducts };
}

// ─── Audit log ───────────────────────────────────────────────

/**
 * Record a tier change in the ActivityLog audit trail.
 * Non-fatal: logging failures never block the underlying tier write.
 *
 * @param {Object} params
 * @param {string|null} params.userId - admin user id (ActivityLog requires one)
 * @param {string} params.action - "tier_created" | "tier_updated" | "tier_deleted" | "tier_activated" | "tier_deactivated"
 * @param {Object} params.details - JSON-serialisable audit detail (tierKey, before, after, actorEmail…)
 */
export async function logTierChange({ userId, action, details }) {
  if (!userId) {
    logger.info(MODULE, `tier audit (no user): ${action} ${JSON.stringify(details)}`);
    return;
  }
  try {
    await prisma.activityLog.create({
      data: { userId, action, details: JSON.stringify(details || {}) },
    });
  } catch (err) {
    logger.warn(MODULE, `audit log failed for ${action}: ${err.message}`);
  }
}

// ─── Writes ──────────────────────────────────────────────────

/**
 * Create or update a tier from admin form data. Thin wrapper over the DB
 * service's `upsertTier` that also writes an audit-trail entry with a
 * before → after diff of the notable fields.
 *
 * @param {Object} tier - normalized tier config (see upsertTier)
 * @param {Object} ctx - { userId, actorEmail }
 * @returns {Promise<Object>} persisted tier
 */
export async function saveTier(tier, { userId = null, actorEmail = null } = {}) {
  const before = await prisma.subscriptionTier
    .findUnique({ where: { name: tier.name } })
    .catch(() => null);

  const saved = await upsertTier(tier, { actorEmail });

  await logTierChange({
    userId,
    action: before ? "tier_updated" : "tier_created",
    details: {
      tierKey: saved.name,
      displayName: saved.displayName,
      actorEmail,
      before: before
        ? { monthlyPrice: before.monthlyPrice, discountPercentage: before.discountPercentage, isActive: before.isActive, allowedCollectionTypes: before.allowedCollectionTypes }
        : null,
      after: { monthlyPrice: saved.monthlyPrice, discountPercentage: saved.discountPercentage, isActive: saved.isActive, allowedCollectionTypes: saved.allowedCollectionTypes },
    },
  });

  return saved;
}

/**
 * Activate or deactivate a tier. Deactivation is always allowed (it just hides
 * the tier from new sign-ups); the caller surfaces subscriber impact warnings.
 *
 * @param {string} tierId
 * @param {boolean} isActive
 * @param {Object} ctx - { userId, actorEmail }
 * @returns {Promise<Object>}
 */
export async function setTierActive(tierId, isActive, { userId = null, actorEmail = null } = {}) {
  const tier = await prisma.subscriptionTier.findUnique({ where: { id: tierId } });
  if (!tier) throw new Error("Tier not found.");

  const updated = await prisma.subscriptionTier.update({
    where: { id: tierId },
    data: { isActive, updatedBy: actorEmail },
  });
  invalidateTierCache();

  await logTierChange({
    userId,
    action: isActive ? "tier_activated" : "tier_deactivated",
    details: { tierKey: tier.name, actorEmail },
  });

  return updated;
}

/**
 * Delete a tier. Refuses when live subscribers are attached — the safety guard
 * required by the spec. Returns `{ blocked, activeSubscribers }` instead of
 * throwing so the UI can render a friendly warning.
 *
 * @param {string} tierId
 * @param {Object} ctx - { userId, actorEmail }
 * @returns {Promise<{deleted: boolean, blocked?: boolean, activeSubscribers?: number}>}
 */
export async function deleteTier(tierId, { userId = null, actorEmail = null } = {}) {
  const tier = await prisma.subscriptionTier.findUnique({ where: { id: tierId } });
  if (!tier) throw new Error("Tier not found.");

  const activeSubscribers = await countActiveSubscribers(tier);
  if (activeSubscribers > 0) {
    return { deleted: false, blocked: true, activeSubscribers };
  }

  await prisma.subscriptionTier.delete({ where: { id: tierId } });
  invalidateTierCache();

  await logTierChange({
    userId,
    action: "tier_deleted",
    details: { tierKey: tier.name, displayName: tier.displayName, actorEmail },
  });

  return { deleted: true };
}

/**
 * Recent tier audit-log entries for the admin activity feed.
 * @param {number} limit
 * @returns {Promise<Object[]>}
 */
export async function getRecentTierAudit(limit = 15) {
  try {
    const rows = await prisma.activityLog.findMany({
      where: { action: { in: ["tier_created", "tier_updated", "tier_deleted", "tier_activated", "tier_deactivated"] } },
      orderBy: { createdAt: "desc" },
      take: limit,
      include: { user: { select: { email: true, firstName: true, lastName: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      action: r.action,
      createdAt: r.createdAt,
      actor: r.user ? (r.user.email || `${r.user.firstName} ${r.user.lastName}`) : "system",
      details: safeParse(r.details),
    }));
  } catch (err) {
    logger.warn(MODULE, `audit fetch failed: ${err.message}`);
    return [];
  }
}

function safeParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}

/** Re-exported so routes can run identical validation server-side. */
export { validateTierConfig };
