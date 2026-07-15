/**
 * Luciteria Collector Cabinet — Subscription Tier Configuration
 *
 * Maps Appstle selling plans to Cabinet assignment configuration. These
 * constants act as the source of truth / fallback when a matching
 * `SubscriptionTier` DB row is not (yet) present.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §7 for the full blueprint.
 *
 * NOTE: Prices here are placeholders (per the architecture doc). The
 * canonical price for a live subscription always comes from the webhook
 * payload / the SubscriptionTier DB row — never hardcoded at billing time.
 */

import { PRICING_DEFAULTS } from "./environment.server.js";

/**
 * Assignment strategies (mirror of STRATEGIES in assignment-engine.server.js).
 * Kept as plain strings so the config has no server-only import chain.
 */
export const DEFAULT_STRATEGY = "wishlist_priority";

/**
 * The three launch tiers. `collectionType` is the value stored on
 * Customer.collectionType and used by the assignment engine.
 */
export const SUBSCRIPTION_TIERS = [
  {
    name: "10mm_monthly",
    displayName: "10mm Cubes — Monthly",
    collectionType: "10mm",
    monthlyPrice: PRICING_DEFAULTS["10mm"],
    billingInterval: "MONTH",
    billingIntervalCount: 1,
    excludePreciousMetals: true,
    maxDiscountPercent: 0.20,
    itemsPerShipment: 1,
    defaultStrategy: DEFAULT_STRATEGY,
    allowDuplicates: false,
    sortOrder: 1,
  },
  {
    name: "25.4mm_monthly",
    displayName: "25.4mm Cubes — Monthly",
    collectionType: "25.4mm",
    monthlyPrice: PRICING_DEFAULTS["25.4mm"],
    billingInterval: "MONTH",
    billingIntervalCount: 1,
    excludePreciousMetals: true,
    maxDiscountPercent: 0.20,
    itemsPerShipment: 1,
    defaultStrategy: DEFAULT_STRATEGY,
    allowDuplicates: false,
    sortOrder: 2,
  },
  {
    name: "lucite_monthly",
    displayName: "Lucite Cubes — Monthly",
    collectionType: "lucite",
    monthlyPrice: PRICING_DEFAULTS.lucite,
    billingInterval: "MONTH",
    billingIntervalCount: 1,
    excludePreciousMetals: true,
    maxDiscountPercent: 0.20,
    itemsPerShipment: 1,
    defaultStrategy: DEFAULT_STRATEGY,
    allowDuplicates: false,
    sortOrder: 3,
  },
];

/** Quick lookup by tier key/name. */
export const TIERS_BY_NAME = Object.fromEntries(
  SUBSCRIPTION_TIERS.map((t) => [t.name, t])
);

/** Quick lookup by collection type. */
export const TIERS_BY_COLLECTION_TYPE = Object.fromEntries(
  SUBSCRIPTION_TIERS.map((t) => [t.collectionType, t])
);

/**
 * Map an Appstle selling plan (name / metadata) to a Cabinet collection type.
 *
 * Resolution order:
 *   1. Explicit `metadata.collection_type`
 *   2. Explicit `metadata.tier_key` → tier config
 *   3. Fuzzy match on the selling plan name
 *   4. Fallback: "lucite"
 *
 * @param {Object} payload - Normalized Appstle webhook payload
 * @returns {string} collection type ("10mm" | "25.4mm" | "lucite")
 */
export function mapSellingPlanToCollectionType(payload = {}) {
  const meta = payload.metadata || {};

  // 1. Explicit collection type in metadata
  if (meta.collection_type && isKnownCollectionType(meta.collection_type)) {
    return meta.collection_type;
  }

  // 2. tier_key → tier config
  if (meta.tier_key && TIERS_BY_NAME[meta.tier_key]) {
    return TIERS_BY_NAME[meta.tier_key].collectionType;
  }

  // 3. Fuzzy match on selling plan name
  const planName = (
    payload.selling_plan_name ||
    payload.selling_plan_group_name ||
    payload.plan_name ||
    ""
  ).toLowerCase();

  if (planName) {
    if (planName.includes("25.4") || planName.includes("25mm") || planName.includes("25 mm")) {
      return "25.4mm";
    }
    if (planName.includes("10mm") || planName.includes("10 mm")) {
      return "10mm";
    }
    if (planName.includes("lucite") || planName.includes("50mm") || planName.includes("2x2")) {
      return "lucite";
    }
  }

  // 4. Fallback
  return "lucite";
}

/**
 * Resolve the tier key ("10mm_monthly" etc.) from a webhook payload.
 * @param {Object} payload
 * @returns {string|null}
 */
export function resolveTierKey(payload = {}) {
  const meta = payload.metadata || {};
  if (meta.tier_key && TIERS_BY_NAME[meta.tier_key]) return meta.tier_key;

  const collectionType = mapSellingPlanToCollectionType(payload);
  const tier = TIERS_BY_COLLECTION_TYPE[collectionType];
  return tier ? tier.name : null;
}

/**
 * Get tier config by collection type (falls back to lucite).
 * @param {string} collectionType
 * @returns {Object}
 */
export function getTierByCollectionType(collectionType) {
  return TIERS_BY_COLLECTION_TYPE[collectionType] || TIERS_BY_COLLECTION_TYPE.lucite;
}

function isKnownCollectionType(ct) {
  return Boolean(TIERS_BY_COLLECTION_TYPE[ct]);
}
