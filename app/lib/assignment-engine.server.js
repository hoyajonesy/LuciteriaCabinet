/**
 * Luciteria Collector Cabinet — Assignment Engine (Phase 2)
 * 
 * Collection-aware assignment logic for subscription shipments.
 * Phase 2 additions:
 *  - Collection type filtering (10mm, 25.4mm, 50mm, lucite, ampoules)
 *  - Discount percentage calculation (retail vs subscription price)
 *  - Admin alert generation for >20% discount items
 *  - Out-of-stock sequence shifting
 *  - Manual override with downstream shifting
 *  - Sequence preview (next N assignments)
 *  - Precious metal exclusion
 */

import { isAvailableForCollection, isPreciousMetal } from "../data/elements.server.js";

/**
 * Assignment strategies — configurable per customer or globally
 */
const STRATEGIES = {
  OLDEST_MISSING: "oldest_missing",
  HIGHEST_OVERSTOCK: "highest_overstock",
  CURATED_LIST: "curated_list",
  CATEGORY_ROTATION: "category_rotation",
  SURPRISE: "surprise",
  WISHLIST_PRIORITY: "wishlist_priority",
};

/**
 * Duplicate handling modes
 */
const DUPLICATE_MODES = {
  NEVER: "never",
  MISSING_ONLY: "missing_only",
  CURATED_SUBS: "curated_subs",
  ALLOW_IF_LIMITED: "allow_if_limited",
  SURPRISE: "surprise",
};

/**
 * Discount thresholds
 */
const DISCOUNT_ALERT_THRESHOLD = 0.20; // 20% — flag for admin review
const DISCOUNT_HARD_CAP = 0.35; // 35% — never auto-assign above this

/**
 * Calculate discount percentage between retail price and subscription cost
 */
function calculateDiscount(retailPrice, subscriptionCost) {
  if (!retailPrice || retailPrice <= 0 || !subscriptionCost) return 0;
  const discount = (retailPrice - subscriptionCost) / retailPrice;
  return Math.max(0, Math.round(discount * 10000) / 10000); // 4 decimal places
}

/**
 * Main assignment function (Phase 2 enhanced)
 * 
 * @param {Object} params
 * @param {Object} params.customer - Customer record with id, collectionType
 * @param {Array}  params.ownedProductIds - IDs of products customer already owns
 * @param {Array}  params.shippedProductIds - IDs of products previously sent via subscription
 * @param {Object} params.preferences - Customer preference settings
 * @param {Array}  params.wishlistProductIds - IDs of products on customer's wishlist
 * @param {Array}  params.allProducts - All products with current inventory
 * @param {string} params.strategy - Assignment strategy to use
 * @param {string} params.collectionType - Customer's collection type (10mm, 25.4mm, 50mm, lucite, ampoules)
 * @param {number} params.subscriptionPrice - Monthly subscription price for discount calc
 * @param {string} params.manualOverrideProductId - Admin override: force this product
 * @returns {Object} { success, product, reason, requiresManualReview, exception, discount, alerts }
 */
function assignNextItem({
  customer,
  ownedProductIds = [],
  shippedProductIds = [],
  preferences = {},
  wishlistProductIds = [],
  allProducts = [],
  strategy = STRATEGIES.WISHLIST_PRIORITY,
  collectionType = null,
  subscriptionPrice = null,
  manualOverrideProductId = null,
}) {
  const duplicateMode = preferences.duplicateHandling || DUPLICATE_MODES.NEVER;
  const alerts = [];
  const ct = collectionType || customer?.collectionType || "lucite";

  // ── Manual Override ────────────────────────────────────────
  if (manualOverrideProductId) {
    const overrideProduct = allProducts.find((p) => p.id === manualOverrideProductId);
    if (!overrideProduct) {
      return {
        success: false,
        product: null,
        reason: "Manual override product not found",
        requiresManualReview: true,
        exception: { reason: "override_failed", details: `Product ${manualOverrideProductId} not found` },
        alerts,
      };
    }
    const discountPct = calculateDiscount(overrideProduct.retailPrice || overrideProduct.priceUsd, subscriptionPrice);
    if (discountPct > DISCOUNT_ALERT_THRESHOLD) {
      alerts.push({
        type: "high_discount_override",
        severity: discountPct > DISCOUNT_HARD_CAP ? "critical" : "warning",
        message: `Manual override: ${overrideProduct.elementSymbol} has ${(discountPct * 100).toFixed(1)}% discount (retail $${(overrideProduct.retailPrice || overrideProduct.priceUsd).toFixed(2)} vs subscription $${subscriptionPrice})`,
        discountPct,
      });
    }
    return {
      success: true,
      product: overrideProduct,
      reason: "Manual admin override",
      requiresManualReview: false,
      flags: ["manual_override"],
      alternates: [],
      exception: null,
      discount: {
        retailPrice: overrideProduct.retailPrice || overrideProduct.priceUsd,
        subscriptionCost: subscriptionPrice,
        discountPct,
        exceedsThreshold: discountPct > DISCOUNT_ALERT_THRESHOLD,
      },
      alerts,
    };
  }

  // ── Step 1: Start with in-stock active products ───────────
  let candidates = allProducts.filter(
    (p) => p.status === "Active" && p.inventoryQty > 0
  );

  if (candidates.length === 0) {
    return {
      success: false,
      product: null,
      reason: "No products currently in stock",
      requiresManualReview: true,
      exception: {
        reason: "no_eligible_items",
        details: `No in-stock products available for ${customer.firstName} ${customer.lastName}`,
      },
      alerts,
    };
  }

  // ── Step 1b: Filter by collection type ────────────────────
  if (ct) {
    candidates = candidates.filter((p) => {
      // Check if product's collectionTypes array includes this type
      if (p.collectionTypes && Array.isArray(p.collectionTypes)) {
        return p.collectionTypes.includes(ct);
      }
      // Fallback: check element availability
      return isAvailableForCollection(p.elementSymbol, ct);
    });

    if (candidates.length === 0) {
      return {
        success: false,
        product: null,
        reason: `No in-stock products available for collection type "${ct}"`,
        requiresManualReview: true,
        exception: {
          reason: "no_eligible_items",
          details: `No in-stock products matching collection type "${ct}" for ${customer.firstName} ${customer.lastName}`,
        },
        alerts,
      };
    }
  }

  // ── Step 1c: Exclude precious metals from subscription ────
  const beforePrecious = candidates.length;
  candidates = candidates.filter((p) => !isPreciousMetal(p.elementSymbol));
  if (candidates.length < beforePrecious) {
    const excluded = beforePrecious - candidates.length;
    alerts.push({
      type: "precious_metals_excluded",
      severity: "info",
      message: `${excluded} precious metal product(s) excluded from subscription pool`,
    });
  }

  if (candidates.length === 0) {
    return {
      success: false,
      product: null,
      reason: "All remaining candidates are precious metals (excluded from subscription)",
      requiresManualReview: true,
      exception: {
        reason: "no_eligible_items",
        details: `Only precious metals remain for ${customer.firstName} — subscription cannot auto-assign these`,
      },
      alerts,
    };
  }

  // ── Step 2: Apply duplicate handling ──────────────────────
  const ownedSet = new Set(ownedProductIds);
  const shippedSet = new Set(shippedProductIds);

  if (duplicateMode === DUPLICATE_MODES.NEVER || duplicateMode === DUPLICATE_MODES.MISSING_ONLY) {
    candidates = candidates.filter(
      (p) => !ownedSet.has(p.id) && !shippedSet.has(p.id)
    );
  } else if (duplicateMode === DUPLICATE_MODES.CURATED_SUBS) {
    candidates = candidates.filter((p) => !ownedSet.has(p.id));
  } else if (duplicateMode === DUPLICATE_MODES.ALLOW_IF_LIMITED) {
    const noDupes = candidates.filter(
      (p) => !ownedSet.has(p.id) && !shippedSet.has(p.id)
    );
    if (noDupes.length > 0) {
      candidates = noDupes;
    }
  }

  // ── Step 3: Apply category/format preferences ─────────────
  const preferredCategories = safeJsonParse(preferences.preferredCategories);
  const excludedCategories = safeJsonParse(preferences.excludedCategories);
  const preferredFormats = safeJsonParse(preferences.preferredFormats);

  if (excludedCategories.length > 0) {
    candidates = candidates.filter(
      (p) => !excludedCategories.includes(p.category)
    );
  }

  let preferred = candidates;
  if (preferredCategories.length > 0) {
    const filtered = candidates.filter((p) =>
      preferredCategories.includes(p.category)
    );
    if (filtered.length > 0) preferred = filtered;
  }
  if (preferredFormats.length > 0) {
    const filtered = preferred.filter((p) =>
      preferredFormats.includes(p.format)
    );
    if (filtered.length > 0) preferred = filtered;
  }

  if (preferences.budgetMaxUsd) {
    const withinBudget = preferred.filter(
      (p) => p.priceUsd <= preferences.budgetMaxUsd
    );
    if (withinBudget.length > 0) preferred = withinBudget;
  }

  candidates = preferred;

  // ── Step 4: Check if any candidates remain ────────────────
  if (candidates.length === 0) {
    return {
      success: false,
      product: null,
      reason: `No eligible items for ${customer.firstName} after applying preferences, collection type, and duplicate rules`,
      requiresManualReview: true,
      exception: {
        reason: "no_eligible_items",
        details: `${customer.firstName} ${customer.lastName} (${ct}) — all eligible items are either owned, shipped, out of stock, precious metals, or excluded by preferences. Owned: ${ownedProductIds.length}, Total: ${allProducts.length}`,
      },
      alerts,
    };
  }

  // ── Step 5: Rank by strategy ──────────────────────────────
  let ranked;

  switch (strategy) {
    case STRATEGIES.WISHLIST_PRIORITY: {
      const wishlistSet = new Set(wishlistProductIds);
      ranked = [...candidates].sort((a, b) => {
        const aWish = wishlistSet.has(a.id) ? 0 : 1;
        const bWish = wishlistSet.has(b.id) ? 0 : 1;
        if (aWish !== bWish) return aWish - bWish;
        return a.atomicNumber - b.atomicNumber;
      });
      break;
    }

    case STRATEGIES.OLDEST_MISSING:
      ranked = [...candidates].sort((a, b) => a.atomicNumber - b.atomicNumber);
      break;

    case STRATEGIES.HIGHEST_OVERSTOCK:
      ranked = [...candidates].sort((a, b) => b.inventoryQty - a.inventoryQty);
      break;

    case STRATEGIES.SURPRISE:
      ranked = shuffleArray([...candidates]);
      break;

    case STRATEGIES.CATEGORY_ROTATION:
      ranked = [...candidates].sort((a, b) => {
        const aCatCount = ownedProductIds.filter((id) => {
          const p = allProducts.find((pr) => pr.id === id);
          return p && p.category === a.category;
        }).length;
        const bCatCount = ownedProductIds.filter((id) => {
          const p = allProducts.find((pr) => pr.id === id);
          return p && p.category === b.category;
        }).length;
        return aCatCount - bCatCount;
      });
      break;

    default:
      ranked = candidates;
  }

  const selected = ranked[0];

  // ── Step 6: Calculate discount and check thresholds ────────
  const retailPrice = selected.retailPrice || selected.priceUsd;
  const subCost = subscriptionPrice || selected.subscriptionCost || selected.priceUsd;
  const discountPct = calculateDiscount(retailPrice, subCost);

  const flags = [];
  if (selected.priceUsd > 200) flags.push("high_value");
  if (selected.inventoryQty <= 2) flags.push("low_stock");
  if (selected.rarityTier === "legendary" || selected.rarityTier === "ultra-rare")
    flags.push("rare_item");

  // Discount alerts
  if (discountPct > DISCOUNT_HARD_CAP) {
    flags.push("discount_exceeds_cap");
    alerts.push({
      type: "discount_hard_cap",
      severity: "critical",
      message: `${selected.elementSymbol}: ${(discountPct * 100).toFixed(1)}% discount exceeds ${(DISCOUNT_HARD_CAP * 100)}% hard cap. Retail: $${retailPrice.toFixed(2)}, Sub cost: $${subCost.toFixed(2)}`,
      discountPct,
      product: selected.id,
    });
  } else if (discountPct > DISCOUNT_ALERT_THRESHOLD) {
    flags.push("high_discount");
    alerts.push({
      type: "high_discount",
      severity: "warning",
      message: `${selected.elementSymbol}: ${(discountPct * 100).toFixed(1)}% discount exceeds ${(DISCOUNT_ALERT_THRESHOLD * 100)}% threshold. Retail: $${retailPrice.toFixed(2)}, Sub cost: $${subCost.toFixed(2)}`,
      discountPct,
      product: selected.id,
    });
  }

  const needsReview = flags.length > 0;

  return {
    success: true,
    product: selected,
    reason: `Selected via ${strategy} strategy (collection: ${ct})`,
    requiresManualReview: needsReview,
    flags,
    alternates: ranked.slice(1, 4),
    exception: needsReview
      ? {
          reason: flags.includes("discount_exceeds_cap") ? "discount_exceeded" : "duplicate_risk",
          details: `Auto-assigned ${selected.title} for ${customer.firstName} ${customer.lastName} (${ct}). Flags: ${flags.join(", ")}. Review recommended.`,
        }
      : null,
    discount: {
      retailPrice,
      subscriptionCost: subCost,
      discountPct,
      exceedsThreshold: discountPct > DISCOUNT_ALERT_THRESHOLD,
      exceedsCap: discountPct > DISCOUNT_HARD_CAP,
    },
    alerts,
  };
}

/**
 * Generate a sequence preview of next N assignments
 * Simulates the assignment engine running forward without modifying state
 * 
 * @param {Object} params
 * @param {Object} params.customer
 * @param {Array}  params.ownedProductIds - Current owned items
 * @param {Array}  params.shippedProductIds
 * @param {Object} params.preferences
 * @param {Array}  params.wishlistProductIds
 * @param {Array}  params.allProducts
 * @param {string} params.strategy
 * @param {string} params.collectionType
 * @param {number} params.subscriptionPrice
 * @param {number} params.count - Number of future assignments to preview (default: 4)
 * @returns {Array} Array of assignment results for the next N months
 */
function previewSequence({
  customer,
  ownedProductIds = [],
  shippedProductIds = [],
  preferences = {},
  wishlistProductIds = [],
  allProducts = [],
  strategy = STRATEGIES.WISHLIST_PRIORITY,
  collectionType = null,
  subscriptionPrice = null,
  count = 4,
}) {
  const sequence = [];
  const simulatedOwned = new Set(ownedProductIds);
  const simulatedShipped = new Set(shippedProductIds);

  // Create a mutable copy of products for stock simulation
  const simProducts = allProducts.map((p) => ({ ...p }));

  for (let i = 0; i < count; i++) {
    const result = assignNextItem({
      customer,
      ownedProductIds: [...simulatedOwned],
      shippedProductIds: [...simulatedShipped],
      preferences,
      wishlistProductIds,
      allProducts: simProducts,
      strategy,
      collectionType,
      subscriptionPrice,
    });

    sequence.push({
      month: i + 1,
      ...result,
    });

    if (result.success && result.product) {
      // Simulate this assignment happening
      simulatedOwned.add(result.product.id);
      simulatedShipped.add(result.product.id);
      // Decrement simulated stock
      const simProd = simProducts.find((p) => p.id === result.product.id);
      if (simProd) simProd.inventoryQty = Math.max(0, simProd.inventoryQty - 1);
    } else {
      // If assignment fails, remaining months will also fail
      break;
    }
  }

  return sequence;
}

/**
 * Handle out-of-stock shifting: when the planned next item goes OOS,
 * shift to the next eligible item and bump the OOS item to when it's back
 */
function shiftForOutOfStock({
  plannedProductId,
  customer,
  ownedProductIds,
  shippedProductIds,
  preferences,
  wishlistProductIds,
  allProducts,
  strategy,
  collectionType,
  subscriptionPrice,
}) {
  const planned = allProducts.find((p) => p.id === plannedProductId);
  
  if (planned && planned.inventoryQty > 0) {
    // Not actually out of stock; no shift needed
    return { shifted: false, originalProduct: planned, newAssignment: null };
  }

  // Run normal assignment (which will skip OOS items)
  const newAssignment = assignNextItem({
    customer,
    ownedProductIds,
    shippedProductIds,
    preferences,
    wishlistProductIds,
    allProducts,
    strategy,
    collectionType,
    subscriptionPrice,
  });

  return {
    shifted: true,
    originalProduct: planned,
    newAssignment,
    reason: `${planned?.elementSymbol || "Unknown"} is out of stock. Shifted to ${newAssignment.success ? newAssignment.product.elementSymbol : "no alternative"}.`,
  };
}

// ─── Helpers ────────────────────────────────────────────────
function safeJsonParse(str) {
  try {
    return JSON.parse(str || "[]");
  } catch {
    return [];
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export {
  assignNextItem,
  previewSequence,
  shiftForOutOfStock,
  calculateDiscount,
  STRATEGIES,
  DUPLICATE_MODES,
  DISCOUNT_ALERT_THRESHOLD,
  DISCOUNT_HARD_CAP,
};
