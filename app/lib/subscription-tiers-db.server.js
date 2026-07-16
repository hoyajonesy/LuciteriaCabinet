/**
 * Luciteria Collector Cabinet — Subscription Tier Database Service
 *
 * Database-backed source of truth for subscription tier configuration. This
 * replaces the hardcoded constants in `app/config/subscription-tiers.server.js`
 * (now deprecated) so tiers can be managed through the admin UI.
 *
 * Design notes:
 *   - A small in-process cache avoids a DB round-trip on every assignment.
 *     Cache entries expire after `CACHE_TTL_MS` and can be invalidated
 *     explicitly (call `invalidateTierCache()` after any tier write).
 *   - Every lookup falls back to the static config file when the database has
 *     no matching row yet (fresh installs, tiers not yet seeded, etc.), so the
 *     assignment flow keeps working during the migration window.
 *   - Returned tier objects are shape-compatible with the old config objects
 *     (name, displayName, collectionType, monthlyPrice, excludePreciousMetals,
 *     maxDiscountPercent, itemsPerShipment, defaultStrategy, allowDuplicates,
 *     sortOrder …) so downstream consumers need no shape changes.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §7 for the tier blueprint.
 */

import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";
import {
  SUBSCRIPTION_TIERS,
  TIERS_BY_NAME,
  TIERS_BY_COLLECTION_TYPE,
  resolveTierKey as resolveTierKeyFromConfig,
  mapSellingPlanToCollectionType,
} from "../config/subscription-tiers.server.js";

const MODULE = "subscription-tiers-db";

/** Cache time-to-live (ms). 5 minutes is plenty for admin-managed tiers. */
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * In-process cache. `all` holds the full active-tier list; the by-key maps are
 * derived from it so a single load populates every lookup path.
 * @type {{ loadedAt: number, all: Object[], byKey: Map<string,Object>, byCollectionType: Map<string,Object>, bySellingPlanId: Map<string,Object> } | null}
 */
let cache = null;

// ─── Validation ──────────────────────────────────────────────

const VALID_COLLECTION_TYPES = ["10mm", "25.4mm", "50mm", "lucite", "ampoules", "ampule"];
const VALID_STRATEGIES = [
  "wishlist_priority",
  "oldest_missing",
  "surprise",
  "sequential",
  "manual",
];

/**
 * Validate a tier configuration object before it is persisted.
 * Throws an Error (with a readable message) on the first failure.
 *
 * Rules:
 *   - name (slug/key) required, non-empty, unique (uniqueness checked in DB).
 *   - displayName required.
 *   - at least one collection type selected (collectionType or allowedCollectionTypes).
 *   - monthlyPrice must be a positive number.
 *   - creditValue, discountPercentage, maxDiscountPercent must be non-negative
 *     when provided; percentages must be between 0 and 1.
 *   - itemsPerShipment must be a positive integer.
 *
 * @param {Object} tier - candidate tier config
 * @param {Object} [opts]
 * @param {string[]} [opts.existingKeys] - known tier keys, to catch duplicates client-side
 * @returns {{ valid: true }}
 */
export function validateTierConfig(tier, { existingKeys = [] } = {}) {
  if (!tier || typeof tier !== "object") {
    throw new Error("Tier configuration must be an object.");
  }

  const key = (tier.name || tier.key || tier.slug || "").trim();
  if (!key) {
    throw new Error("Tier key (name/slug) is required.");
  }
  if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(key)) {
    throw new Error(`Tier key "${key}" is invalid — use letters, numbers, dot, dash or underscore.`);
  }
  if (existingKeys.includes(key)) {
    throw new Error(`Duplicate tier key "${key}" — tier keys must be unique.`);
  }

  if (!tier.displayName || !String(tier.displayName).trim()) {
    throw new Error("displayName is required.");
  }

  // At least one collection type must be selected.
  const collectionTypes = collectionTypesOf(tier);
  if (collectionTypes.length === 0) {
    throw new Error("At least one collection type must be selected.");
  }
  const badType = collectionTypes.find((ct) => !VALID_COLLECTION_TYPES.includes(ct));
  if (badType) {
    throw new Error(`Unknown collection type "${badType}".`);
  }

  // Pricing.
  if (typeof tier.monthlyPrice !== "number" || !isFinite(tier.monthlyPrice) || tier.monthlyPrice <= 0) {
    throw new Error("monthlyPrice must be a positive number.");
  }
  if (tier.creditValue != null && (typeof tier.creditValue !== "number" || tier.creditValue < 0)) {
    throw new Error("creditValue must be a non-negative number.");
  }
  for (const field of ["discountPercentage", "maxDiscountPercent"]) {
    const v = tier[field];
    if (v != null) {
      if (typeof v !== "number" || v < 0 || v > 1) {
        throw new Error(`${field} must be a fraction between 0 and 1 (e.g. 0.20 for 20%).`);
      }
    }
  }

  if (tier.itemsPerShipment != null) {
    if (!Number.isInteger(tier.itemsPerShipment) || tier.itemsPerShipment <= 0) {
      throw new Error("itemsPerShipment must be a positive integer.");
    }
  }

  if (tier.defaultStrategy && !VALID_STRATEGIES.includes(tier.defaultStrategy)) {
    throw new Error(`Unknown assignment strategy "${tier.defaultStrategy}".`);
  }

  return { valid: true };
}

/** Collect the set of collection types a tier covers (array + singular). */
function collectionTypesOf(tier) {
  const set = new Set();
  if (Array.isArray(tier.allowedCollectionTypes)) {
    for (const ct of tier.allowedCollectionTypes) if (ct) set.add(ct);
  }
  if (tier.collectionType) set.add(tier.collectionType);
  return [...set];
}

// ─── Cache management ────────────────────────────────────────

/** Drop the cached tier data so the next lookup re-reads from the DB. */
export function invalidateTierCache() {
  cache = null;
  logger.debug?.(MODULE, "tier cache invalidated");
}

function cacheIsFresh() {
  return cache && Date.now() - cache.loadedAt < CACHE_TTL_MS;
}

/**
 * Load all active tiers from the DB into the cache. Falls back to the static
 * config when the DB read fails or returns nothing.
 * @returns {Promise<Object[]>}
 */
async function loadCache() {
  if (cacheIsFresh()) return cache.all;

  let rows = [];
  try {
    rows = await prisma.subscriptionTier.findMany({
      where: { isActive: true },
      orderBy: [{ displayOrder: "asc" }, { sortOrder: "asc" }],
    });
  } catch (err) {
    logger.warn(MODULE, `DB tier load failed, using config fallback: ${err.message}`);
    rows = [];
  }

  const all = rows.length > 0 ? rows.map(normalizeTier) : SUBSCRIPTION_TIERS.map(normalizeTier);

  const byKey = new Map();
  const byCollectionType = new Map();
  const bySellingPlanId = new Map();
  for (const t of all) {
    byKey.set(t.name, t);
    // Map every collection type the tier covers.
    for (const ct of collectionTypesOf(t)) {
      if (!byCollectionType.has(ct)) byCollectionType.set(ct, t);
    }
    if (t.appstleSellingPlanId) bySellingPlanId.set(t.appstleSellingPlanId, t);
    if (t.shopifySellingPlanId) bySellingPlanId.set(t.shopifySellingPlanId, t);
  }

  cache = { loadedAt: Date.now(), all, byKey, byCollectionType, bySellingPlanId };
  return all;
}

/**
 * Normalize a DB row (or config object) into a consistent tier shape with
 * sane defaults, so consumers never have to null-check.
 */
function normalizeTier(t) {
  const allowed = Array.isArray(t.allowedCollectionTypes) ? t.allowedCollectionTypes.filter(Boolean) : [];
  return {
    id: t.id || null,
    name: t.name,
    displayName: t.displayName,
    description: t.description ?? null,
    collectionType: t.collectionType,
    allowedCollectionTypes: allowed.length > 0 ? allowed : (t.collectionType ? [t.collectionType] : []),
    appstleSellingPlanId: t.appstleSellingPlanId ?? null,
    shopifySellingPlanId: t.shopifySellingPlanId ?? null,
    shopifyProductId: t.shopifyProductId ?? null,
    monthlyPrice: t.monthlyPrice,
    creditValue: t.creditValue ?? null,
    discountPercentage: t.discountPercentage ?? t.maxDiscountPercent ?? 0.20,
    billingInterval: t.billingInterval || "MONTH",
    billingIntervalCount: t.billingIntervalCount || 1,
    excludePreciousMetals: t.excludePreciousMetals ?? true,
    maxDiscountPercent: t.maxDiscountPercent ?? 0.20,
    itemsPerShipment: t.itemsPerShipment || 1,
    defaultStrategy: t.defaultStrategy || "wishlist_priority",
    allowDuplicates: t.allowDuplicates ?? false,
    isActive: t.isActive ?? true,
    sortOrder: t.sortOrder ?? 0,
    displayOrder: t.displayOrder ?? t.sortOrder ?? 0,
  };
}

// ─── Public lookups ──────────────────────────────────────────

/**
 * Fetch all active tiers (cached), ordered by display order.
 * @returns {Promise<Object[]>}
 */
export async function getAllTiers() {
  return loadCache();
}

/**
 * Fetch a single tier by its key/slug (the `name` column).
 * Falls back to the config constant when not found in the DB.
 * @param {string} key
 * @returns {Promise<Object|null>}
 */
export async function getTierByKey(key) {
  if (!key) return null;
  await loadCache();
  if (cache.byKey.has(key)) return cache.byKey.get(key);
  const cfg = TIERS_BY_NAME[key];
  return cfg ? normalizeTier(cfg) : null;
}

/**
 * Match an Seal (or Shopify) selling plan id to its tier configuration.
 * @param {string} sellingPlanId
 * @returns {Promise<Object|null>}
 */
export async function getTierBySellingPlanId(sellingPlanId) {
  if (!sellingPlanId) return null;
  await loadCache();
  return cache.bySellingPlanId.get(sellingPlanId) || null;
}

/**
 * Fetch a tier by collection type. Falls back to the config constant, and
 * finally to the "lucite" tier, so this never returns null for a live flow.
 * @param {string} collectionType
 * @returns {Promise<Object>}
 */
export async function getTierByCollectionType(collectionType) {
  await loadCache();
  if (collectionType && cache.byCollectionType.has(collectionType)) {
    return cache.byCollectionType.get(collectionType);
  }
  // Fallback chain: config by collection type → config lucite.
  const cfg =
    TIERS_BY_COLLECTION_TYPE[collectionType] || TIERS_BY_COLLECTION_TYPE.lucite;
  return normalizeTier(cfg);
}

/**
 * Resolve the tier key ("10mm_monthly" …) from a normalized Seal payload,
 * preferring a DB match on the selling plan id, then metadata/name heuristics.
 * @param {Object} payload
 * @returns {Promise<string|null>}
 */
export async function resolveTierKey(payload = {}) {
  const sellingPlanId = payload.sellingPlanId || payload.selling_plan_id || null;
  if (sellingPlanId) {
    const tier = await getTierBySellingPlanId(sellingPlanId);
    if (tier) return tier.name;
  }
  // Fall back to the config-based resolver (metadata/name heuristics).
  return resolveTierKeyFromConfig(payload);
}

/**
 * Resolve the full tier config from a normalized Seal payload.
 * @param {Object} payload
 * @returns {Promise<Object>}
 */
export async function getTierForPayload(payload = {}) {
  const sellingPlanId = payload.sellingPlanId || payload.selling_plan_id || null;
  if (sellingPlanId) {
    const bySelling = await getTierBySellingPlanId(sellingPlanId);
    if (bySelling) return bySelling;
  }
  const collectionType = payload.collectionType || mapSellingPlanToCollectionType(payload);
  return getTierByCollectionType(collectionType);
}

/**
 * Create or update a tier from the admin UI. Validates the config, persists it,
 * and invalidates the cache. `name` is the unique key used for upsert.
 * @param {Object} tier
 * @param {Object} [opts]
 * @param {string} [opts.actorEmail] - admin performing the change (audit)
 * @returns {Promise<Object>} the persisted, normalized tier
 */
export async function upsertTier(tier, { actorEmail = null } = {}) {
  // For create, catch duplicate keys against the current set.
  const existing = await prisma.subscriptionTier.findUnique({ where: { name: tier.name } }).catch(() => null);
  const existingKeys = existing ? [] : (await getAllTiers()).map((t) => t.name);
  validateTierConfig(tier, { existingKeys });

  const data = {
    displayName: tier.displayName,
    description: tier.description ?? null,
    collectionType: tier.collectionType,
    allowedCollectionTypes: collectionTypesOf(tier),
    appstleSellingPlanId: tier.appstleSellingPlanId ?? null,
    shopifySellingPlanId: tier.shopifySellingPlanId ?? null,
    shopifyProductId: tier.shopifyProductId ?? null,
    monthlyPrice: tier.monthlyPrice,
    creditValue: tier.creditValue ?? null,
    discountPercentage: tier.discountPercentage ?? tier.maxDiscountPercent ?? 0.20,
    billingInterval: tier.billingInterval || "MONTH",
    billingIntervalCount: tier.billingIntervalCount || 1,
    excludePreciousMetals: tier.excludePreciousMetals ?? true,
    maxDiscountPercent: tier.maxDiscountPercent ?? 0.20,
    itemsPerShipment: tier.itemsPerShipment || 1,
    defaultStrategy: tier.defaultStrategy || "wishlist_priority",
    allowDuplicates: tier.allowDuplicates ?? false,
    isActive: tier.isActive ?? true,
    sortOrder: tier.sortOrder ?? tier.displayOrder ?? 0,
    displayOrder: tier.displayOrder ?? tier.sortOrder ?? 0,
    updatedBy: actorEmail,
  };

  const row = await prisma.subscriptionTier.upsert({
    where: { name: tier.name },
    update: data,
    create: { name: tier.name, createdBy: actorEmail, ...data },
  });

  invalidateTierCache();
  return normalizeTier(row);
}
