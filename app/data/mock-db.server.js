/**
 * Luciteria Collector Cabinet — Data Access Layer (Phase 2.5 Refactor)
 *
 * HYBRID APPROACH:
 * - Products come from the REAL SKU mapping (1654 products from Shopify export)
 * - Customers/subscriptions/shipments use mock data for the prototype
 * - In production, everything comes from Prisma + Shopify API
 *
 * This file maintains the same export interface as the original mock-db,
 * so all 11+ routes that `import * as db from "../data/mock-db.server"`
 * continue to work without any changes.
 *
 * DEVELOPER NOTE:
 * When switching to production (APP_MODE=production), replace calls to
 * the mock functions below with calls to:
 *   - app/lib/data-access.server.js (Prisma queries)
 *   - app/integrations/shopify/ (Shopify API)
 *
 * The mock data is retained so the prototype remains fully functional
 * without a database or Shopify credentials.
 */

import {
  ELEMENTS_118, COLLECTION_TYPES, isAvailableForCollection,
  isPreciousMetal, getAvailableCount,
} from "./elements.server.js";

import {
  ALL_PRODUCTS as CATALOG_PRODUCTS,
  SUBSCRIPTION_PRODUCTS,
  getCatalogProducts,
  getSubscriptionProducts,
  getProductBySku as catalogGetBySku,
  getProductById as catalogGetById,
  getAvailableElementCount,
  getCollectionTypeStats,
} from "./product-catalog.server.js";

import { logger } from "../lib/error-handling.server.js";

const MODULE = "data-access";

// ─── REAL PRODUCTS (from SKU mapping CSV) ────────────────────
// Use the first subscription-eligible product per element+collectionType
// for the mock customer collections. This gives us real SKUs and prices.

/**
 * Build a curated product pool for the prototype mock layer.
 * Takes subscription-eligible products and deduplicates by element+type.
 * This gives ~596 products matching what would actually be in the subscription.
 */
function buildPrototypeProducts() {
  // Start with subscription products, then fill with the top product per element/type
  const seen = new Set();
  const pool = [];

  for (const p of SUBSCRIPTION_PRODUCTS) {
    const key = `${p.elementSymbol}_${p.collectionTypes[0]}`;
    if (!seen.has(key) && p.elementSymbol) {
      seen.add(key);
      pool.push(p);
    }
  }

  logger.info(MODULE, `Loaded ${pool.length} unique element-type products from real catalog (of ${CATALOG_PRODUCTS.length} total SKUs)`);
  return pool;
}

const products = buildPrototypeProducts();

// Map legacy product IDs to real IDs for mock customer data
function findProductBySkuOrElement(sku, elementSymbol, collectionType) {
  // Try exact SKU match first
  let p = products.find((pr) => pr.sku === sku);
  if (p) return p;
  // Fall back to element + collection type
  if (elementSymbol && collectionType) {
    p = products.find((pr) => pr.elementSymbol === elementSymbol && pr.collectionTypes.includes(collectionType));
  }
  if (p) return p;
  // Fall back to element only
  if (elementSymbol) {
    p = products.find((pr) => pr.elementSymbol === elementSymbol);
  }
  return p || null;
}

// ─── MOCK CUSTOMERS ──────────────────────────────────────────
const customers = [
  { id: "cust_001", shopifyId: "shp_001", email: "marcus.chen@example.com", firstName: "Marcus", lastName: "Chen", displayName: "The Completionist", collectionType: "lucite" },
  { id: "cust_002", shopifyId: "shp_002", email: "sarah.kovacs@example.com", firstName: "Sarah", lastName: "Kovacs", displayName: "The Curator", collectionType: "lucite" },
  { id: "cust_003", shopifyId: "shp_003", email: "david.nakamura@example.com", firstName: "David", lastName: "Nakamura", displayName: "The Newcomer", collectionType: "10mm" },
  { id: "cust_004", shopifyId: "shp_004", email: "elena.ross@example.com", firstName: "Elena", lastName: "Ross", displayName: "The Completionist Elite", collectionType: "lucite" },
  { id: "cust_005", shopifyId: "shp_005", email: "james.walker@example.com", firstName: "James", lastName: "Walker", displayName: "The Cubist", collectionType: "25.4mm" },
  { id: "cust_006", shopifyId: "shp_006", email: "mia.tanaka@example.com", firstName: "Mia", lastName: "Tanaka", displayName: "The Ampoule Aficionado", collectionType: "ampoules" },
];

// ─── COLLECTION RECORDS (using REAL products) ────────────────
const collectionRecords = {};

// Helper: build owned list from real products for a collection type
function buildOwnedFromElements(elementSymbols, collectionType, acquiredDate = "2025-06-15") {
  return elementSymbols.map((sym) => {
    const p = findProductBySkuOrElement(null, sym, collectionType);
    return p ? { productId: p.id, acquiredVia: "subscription", acquiredDate, collectionType } : null;
  }).filter(Boolean);
}

// Marcus owns ~16 lucite (missing 4 specific ones)
const luciteProducts = products.filter((p) => p.collectionTypes.includes("lucite") && p.availableForSubscription && !isPreciousMetal(p.elementSymbol));
const marcusMissing = new Set(["Pa", "Db", "Eu", "Hf"]); // 4 missing
const marcusOwned = luciteProducts.filter((p) => !marcusMissing.has(p.elementSymbol)).slice(0, 16);
collectionRecords["cust_001"] = marcusOwned.map((p) => ({ productId: p.id, acquiredVia: "subscription", acquiredDate: "2025-06-15", collectionType: "lucite" }));

// Sarah owns 8 lucite
const sarahElements = ["Na", "Cr", "S", "Al", "Mg", "Sn", "Si", "Sr"];
collectionRecords["cust_002"] = buildOwnedFromElements(sarahElements, "lucite", "2025-09-15");

// David owns 3 of 10mm
const davidElements = ["Fe", "Cu", "Ti"];
collectionRecords["cust_003"] = buildOwnedFromElements(davidElements, "10mm", "2026-04-15");

// Elena owns 20 lucite (near-complete)
const elenaOwned = luciteProducts.slice(0, 20);
collectionRecords["cust_004"] = elenaOwned.map((p) => ({ productId: p.id, acquiredVia: "subscription", acquiredDate: "2024-06-15", collectionType: "lucite" }));

// James owns 2 of 25.4mm
const jamesElements = ["Al", "Cu"];
collectionRecords["cust_005"] = buildOwnedFromElements(jamesElements, "25.4mm", "2026-03-01");

// Mia owns 1 ampoule
const miaElements = ["Ga"];
collectionRecords["cust_006"] = buildOwnedFromElements(miaElements, "ampoules", "2026-05-01");

// ─── WISHLISTS (mapped to real products) ─────────────────────
function wishlistEntry(sym, ct, priority, notify = true) {
  const p = findProductBySkuOrElement(null, sym, ct);
  return p ? { productId: p.id, priority, notifyOnRestock: notify } : null;
}

const wishlists = {
  cust_001: [wishlistEntry("Pa", "lucite", 1), wishlistEntry("Db", "lucite", 2), wishlistEntry("Eu", "lucite", 3)].filter(Boolean),
  cust_002: [wishlistEntry("Ce", "lucite", 1, false), wishlistEntry("La", "lucite", 2, false), wishlistEntry("Er", "lucite", 3, false)].filter(Boolean),
  cust_003: [wishlistEntry("W", "10mm", 1)].filter(Boolean),
  cust_004: [],
  cust_005: [wishlistEntry("Ti", "25.4mm", 1)].filter(Boolean),
  cust_006: [wishlistEntry("Cs", "ampoules", 1), wishlistEntry("Rb", "ampoules", 2)].filter(Boolean),
};

// ─── SUBSCRIPTIONS ───────────────────────────────────────────
const subscriptions = {
  cust_001: {
    id: "sub_001", planName: "Completionist", planTier: "ultimate", status: "active",
    billingCadence: "monthly", priceUsd: 129.99, nextShipmentDate: "2026-06-01",
    nextBillingDate: "2026-06-01", startDate: "2025-01-15", itemsPerShipment: 1,
    collectionType: "lucite",
    priceLockedAt: "2025-01-15", priceExpiresAt: "2026-07-15", originalPrice: 119.99,
    grandfathered: true,
  },
  cust_002: {
    id: "sub_002", planName: "Element Explorer", planTier: "basic", status: "active",
    billingCadence: "monthly", priceUsd: 129.99, nextShipmentDate: "2026-06-15",
    nextBillingDate: "2026-06-15", startDate: "2025-07-01", itemsPerShipment: 1,
    collectionType: "lucite",
    priceLockedAt: null, priceExpiresAt: null, originalPrice: null, grandfathered: false,
  },
  cust_003: {
    id: "sub_003", planName: "Element Explorer", planTier: "basic", status: "active",
    billingCadence: "monthly", priceUsd: 49.99, nextShipmentDate: "2026-06-01",
    nextBillingDate: "2026-06-01", startDate: "2026-05-01", itemsPerShipment: 1,
    collectionType: "10mm",
    priceLockedAt: null, priceExpiresAt: null, originalPrice: null, grandfathered: false,
  },
  cust_004: {
    id: "sub_004", planName: "Completionist", planTier: "ultimate", status: "active",
    billingCadence: "monthly", priceUsd: 129.99, nextShipmentDate: "2026-06-01",
    nextBillingDate: "2026-06-01", startDate: "2024-01-01", itemsPerShipment: 1,
    collectionType: "lucite",
    priceLockedAt: "2024-01-01", priceExpiresAt: "2024-07-01", originalPrice: 99.99,
    grandfathered: false,
  },
  cust_005: {
    id: "sub_005", planName: "Element Explorer", planTier: "basic", status: "active",
    billingCadence: "monthly", priceUsd: 79.99, nextShipmentDate: "2026-06-01",
    nextBillingDate: "2026-06-01", startDate: "2026-02-15", itemsPerShipment: 1,
    collectionType: "25.4mm",
    priceLockedAt: null, priceExpiresAt: null, originalPrice: null, grandfathered: false,
  },
  cust_006: {
    id: "sub_006", planName: "Element Explorer", planTier: "basic", status: "active",
    billingCadence: "monthly", priceUsd: 69.99, nextShipmentDate: "2026-06-15",
    nextBillingDate: "2026-06-15", startDate: "2026-04-01", itemsPerShipment: 1,
    collectionType: "ampoules",
    priceLockedAt: null, priceExpiresAt: null, originalPrice: null, grandfathered: false,
  },
};

// ─── SHIPMENTS (references real products) ────────────────────
function shipmentItem(sym, ct) {
  const p = findProductBySkuOrElement(null, sym, ct);
  return p ? p.id : null;
}

const shipments = {
  cust_001: [
    { id: "ship_001", date: "2026-03-01", status: "delivered", tracking: "LUCXK8M9QP2", items: [shipmentItem("Ts", "lucite")].filter(Boolean), retailPrice: 49.99, assignedPrice: 129.99, discountPercent: 0 },
    { id: "ship_002", date: "2026-04-01", status: "delivered", tracking: "LUCRT4N7WE3", items: [shipmentItem("Er", "lucite")].filter(Boolean), retailPrice: 94.99, assignedPrice: 129.99, discountPercent: 0 },
    { id: "ship_003", date: "2026-05-01", status: "shipped", tracking: "LUCAM2P5JK8", items: [shipmentItem("As", "lucite")].filter(Boolean), retailPrice: 84.99, assignedPrice: 129.99, discountPercent: 0 },
  ],
  cust_002: [
    { id: "ship_004", date: "2026-04-15", status: "delivered", tracking: "LUCBN3R8KL1", items: [shipmentItem("Sn", "lucite")].filter(Boolean), retailPrice: 74.99, assignedPrice: 129.99, discountPercent: 0 },
    { id: "ship_005", date: "2026-05-15", status: "delivered", tracking: "LUCWP7T2MX4", items: [shipmentItem("Si", "lucite")].filter(Boolean), retailPrice: 69.99, assignedPrice: 129.99, discountPercent: 0 },
  ],
  cust_003: [
    { id: "ship_009", date: "2026-05-01", status: "delivered", tracking: "LUCDF2G7HJ5", items: [shipmentItem("Fe", "10mm")].filter(Boolean), retailPrice: 19.99, assignedPrice: 49.99, discountPercent: 60 },
  ],
  cust_004: [
    { id: "ship_006", date: "2026-03-01", status: "delivered", tracking: "LUCEJ5K9PQ7", items: [shipmentItem("Ts", "lucite")].filter(Boolean), retailPrice: 49.99, assignedPrice: 129.99, discountPercent: 0 },
    { id: "ship_008", date: "2026-05-01", status: "skipped", tracking: null, items: [], retailPrice: 0, assignedPrice: 0, discountPercent: 0 },
  ],
  cust_005: [
    { id: "ship_010", date: "2026-05-01", status: "delivered", tracking: "LUCQR8S3TU6", items: [shipmentItem("Al", "25.4mm")].filter(Boolean), retailPrice: 39.99, assignedPrice: 79.99, discountPercent: 50 },
  ],
  cust_006: [
    { id: "ship_011", date: "2026-05-15", status: "delivered", tracking: "LUCVW4X9YZ1", items: [shipmentItem("Ga", "ampoules")].filter(Boolean), retailPrice: 49.99, assignedPrice: 69.99, discountPercent: 29 },
  ],
};

// ─── PREFERENCES ─────────────────────────────────────────────
const preferences = {
  cust_001: { duplicateHandling: "never", preferredCategories: ["Lucite Cube"], excludedCategories: [], preferredFormats: ["50mm"], budgetMaxUsd: null, communicationEmail: true, communicationSms: true, shipmentNotifications: true, restockAlerts: true, priceChangeAlerts: true },
  cust_002: { duplicateHandling: "missing_only", preferredCategories: ["Lucite Cube"], excludedCategories: [], preferredFormats: ["50mm", "31mm"], budgetMaxUsd: null, communicationEmail: true, communicationSms: false, shipmentNotifications: true, restockAlerts: false, priceChangeAlerts: true },
  cust_003: { duplicateHandling: "surprise", preferredCategories: [], excludedCategories: [], preferredFormats: [], budgetMaxUsd: null, communicationEmail: true, communicationSms: false, shipmentNotifications: true, restockAlerts: true, priceChangeAlerts: true },
  cust_004: { duplicateHandling: "curated_subs", preferredCategories: ["Lucite Cube"], excludedCategories: [], preferredFormats: ["50mm"], budgetMaxUsd: 500, communicationEmail: true, communicationSms: true, shipmentNotifications: true, restockAlerts: true, priceChangeAlerts: true },
  cust_005: { duplicateHandling: "never", preferredCategories: ["Metal Cube"], excludedCategories: [], preferredFormats: ["25.4mm"], budgetMaxUsd: null, communicationEmail: true, communicationSms: false, shipmentNotifications: true, restockAlerts: true, priceChangeAlerts: false },
  cust_006: { duplicateHandling: "never", preferredCategories: ["Ampoule"], excludedCategories: [], preferredFormats: ["ampoule"], budgetMaxUsd: null, communicationEmail: true, communicationSms: false, shipmentNotifications: true, restockAlerts: true, priceChangeAlerts: true },
};

// ─── EXCEPTIONS ──────────────────────────────────────────────
const exceptions = [
  { id: "exc_001", customerId: "cust_004", reason: "no_eligible_items", status: "pending", details: "Elena owns 20 lucite items. Only a few new items available for subscription.", createdAt: "2026-05-15" },
  { id: "exc_002", customerId: "cust_001", reason: "duplicate_risk", status: "pending", details: "Marcus has very few items remaining. Low eligible count.", createdAt: "2026-05-18" },
  { id: "exc_003", customerId: "cust_006", reason: "high_discount", status: "pending", details: "Mia's last shipment had 29% discount. Monitor profitability.", createdAt: "2026-05-20" },
];

// ─── ADMIN NOTES ─────────────────────────────────────────────
const adminNotes = {
  cust_001: [{ author: "Chris", content: "Marcus is near-complete in lucite. Prioritize rare items.", date: "2026-05-10" }],
  cust_002: [{ author: "Chris", content: "Sarah prefers classic elements. Great email engagement.", date: "2026-04-20" }],
  cust_003: [{ author: "Chris", content: "New 10mm subscriber. Send a visually impressive welcome element.", date: "2026-05-01" }],
  cust_004: [{ author: "Chris", content: "Elena near-complete. Consider switching to different collection type.", date: "2026-05-15" }],
  cust_005: [{ author: "Chris", content: "James building 25.4mm collection. Good candidate for upsell to 50mm.", date: "2026-03-15" }],
  cust_006: [{ author: "Chris", content: "Mia collecting ampoules — niche but dedicated. Watch profitability.", date: "2026-05-01" }],
};

// ─── PRICING HISTORY ─────────────────────────────────────────
const pricingHistory = [
  { id: "ph_001", collectionType: "lucite", oldPrice: 119.99, newPrice: 129.99, effectiveDate: "2025-06-01", grandfatheringWeeks: 26, changedBy: "Chris" },
  { id: "ph_002", collectionType: "10mm", oldPrice: 44.99, newPrice: 49.99, effectiveDate: "2026-01-01", grandfatheringWeeks: 0, changedBy: "Chris" },
];

// ─── NOTIFICATION LOG ────────────────────────────────────────
const notificationLog = [
  { id: "notif_001", type: "shipment_shipped", customerId: "cust_001", subject: "Your element is on its way!", details: "Arsenic 50mm Lucite Cube shipped via FedEx", sentAt: "2026-05-01", channel: "email" },
  { id: "notif_002", type: "price_change", customerId: "cust_001", subject: "Your grandfathered pricing update", details: "Lucite subscription price locked at $119.99 until 2026-07-15", sentAt: "2026-01-15", channel: "email" },
];

// ─── ADMIN SESSION ───────────────────────────────────────────
const adminSessions = {
  "admin_default": { id: "admin_default", name: "Chris", email: "chris@luciteria.com", role: "admin", authenticated: true },
};

// ═══════════════════════════════════════════════════════════════
// DATA ACCESS FUNCTIONS
// All routes import these. Interface is identical to original mock-db.
// ═══════════════════════════════════════════════════════════════

function getProducts(collectionType) {
  if (collectionType) {
    return products.filter((p) => p.collectionTypes.includes(collectionType));
  }
  return products;
}

function getProductById(id) { return products.find((p) => p.id === id); }
function getProductBySku(sku) { return products.find((p) => p.sku === sku); }

function getCustomers() { return customers; }
function getCustomerById(id) { return customers.find((c) => c.id === id); }

function getCustomerCollection(customerId, collectionType) {
  const records = collectionRecords[customerId] || [];
  const filtered = collectionType ? records.filter((r) => r.collectionType === collectionType) : records;
  return filtered.map((r) => ({ ...r, product: getProductById(r.productId) }));
}

function getOwnedProductIds(customerId, collectionType) {
  const records = collectionRecords[customerId] || [];
  const filtered = collectionType ? records.filter((r) => r.collectionType === collectionType) : records;
  return filtered.map((r) => r.productId);
}

function getOwnedElementSymbols(customerId, collectionType) {
  const collection = getCustomerCollection(customerId, collectionType);
  return new Set(collection.map((r) => r.product?.elementSymbol).filter(Boolean));
}

function getMissingProducts(customerId, collectionType) {
  const owned = new Set(getOwnedProductIds(customerId, collectionType));
  let pool = products.filter((p) => !owned.has(p.id) && p.status === "Active");
  if (collectionType) {
    pool = pool.filter((p) => p.collectionTypes.includes(collectionType));
  }
  return pool;
}

function getWishlist(customerId) {
  return (wishlists[customerId] || []).map((w) => ({ ...w, product: getProductById(w.productId) }));
}
function getWishlistProductIds(customerId) {
  return (wishlists[customerId] || []).map((w) => w.productId);
}

function getSubscription(customerId) { return subscriptions[customerId] || null; }

function getShipments(customerId) {
  return (shipments[customerId] || []).map((s) => ({
    ...s,
    itemProducts: s.items.map((pid) => getProductById(pid)).filter(Boolean),
  }));
}
function getShippedProductIds(customerId) {
  return (shipments[customerId] || []).flatMap((s) => s.items);
}

function getPreferences(customerId) { return preferences[customerId] || null; }
function getExceptions() { return exceptions; }
function getPendingExceptions() { return exceptions.filter((e) => e.status === "pending"); }
function getAdminNotes(customerId) { return adminNotes[customerId] || []; }
function getPricingHistory() { return pricingHistory; }
function getNotificationLog(customerId) {
  if (customerId) return notificationLog.filter((n) => n.customerId === customerId);
  return notificationLog;
}
function getAdminSession() { return adminSessions["admin_default"]; }

function getCustomerStats(customerId) {
  const customer = getCustomerById(customerId);
  const ct = customer?.collectionType || "lucite";
  const owned = getOwnedProductIds(customerId, ct);
  const wishlist = wishlists[customerId] || [];
  const sub = subscriptions[customerId];
  const shpmts = shipments[customerId] || [];
  const totalForType = products.filter((p) => p.collectionTypes.includes(ct) && p.status === "Active").length;
  const availableForType = getAvailableCount(ct);

  return {
    totalCollected: owned.length,
    totalProducts: totalForType,
    totalAvailableElements: availableForType,
    completionPct: totalForType > 0 ? Math.round((owned.length / totalForType) * 100) : 0,
    missingCount: totalForType - owned.length,
    wishlistCount: wishlist.length,
    subscriptionStatus: sub?.status || "none",
    planName: sub?.planName || "None",
    collectionType: ct,
    collectionTypeLabel: COLLECTION_TYPES[ct]?.label || ct,
    totalShipments: shpmts.length,
    recentShipments: shpmts.slice(0, 3),
    avgDiscount: shpmts.length > 0
      ? Math.round(shpmts.filter((s) => s.discountPercent > 0).reduce((a, s) => a + s.discountPercent, 0) / Math.max(1, shpmts.filter((s) => s.discountPercent > 0).length))
      : 0,
    isGrandfathered: sub?.priceLockedAt && sub?.priceExpiresAt && new Date(sub.priceExpiresAt) > new Date(),
  };
}

function getDashboardStats() {
  const activeProducts = products.filter((p) => p.status === "Active");
  const inStock = activeProducts.filter((p) => p.inventoryQty > 0);
  const activeSubs = Object.values(subscriptions).filter((s) => s.status === "active");

  // Real collection type stats from the catalog
  const catalogStats = getCollectionTypeStats();

  return {
    totalCustomers: customers.length,
    activeSubscriptions: activeSubs.length,
    pendingExceptions: exceptions.filter((e) => e.status === "pending").length,
    totalProducts: activeProducts.length,
    inStockProducts: inStock.length,
    outOfStockProducts: activeProducts.length - inStock.length,
    totalShipments: Object.values(shipments).reduce((a, s) => a + s.length, 0),
    totalInventoryUnits: inStock.reduce((a, p) => a + p.inventoryQty, 0),
    // Phase 2
    mrr: activeSubs.reduce((a, s) => a + s.priceUsd, 0),
    collectionTypeBreakdown: Object.entries(COLLECTION_TYPES).map(([key, ct]) => ({
      type: key,
      label: ct.label,
      subscribers: activeSubs.filter((s) => s.collectionType === key).length,
      revenue: activeSubs.filter((s) => s.collectionType === key).reduce((a, s) => a + s.priceUsd, 0),
      // Real catalog data
      totalSkus: catalogStats.find((s) => s.type === key)?.totalSkus || 0,
      uniqueElements: catalogStats.find((s) => s.type === key)?.uniqueElements || 0,
    })),
    grandfatheredCount: Object.values(subscriptions).filter((s) => s.grandfathered).length,
    highDiscountShipments: Object.values(shipments).flat().filter((s) => s.discountPercent > 20),
    // Real catalog summary
    totalCatalogSkus: CATALOG_PRODUCTS.length,
    subscriptionEligibleSkus: SUBSCRIPTION_PRODUCTS.length,
  };
}

function getUpcomingAssignments() {
  return Object.entries(subscriptions)
    .filter(([, sub]) => sub.status === "active")
    .map(([custId, sub]) => {
      const customer = getCustomerById(custId);
      const ct = sub.collectionType || customer?.collectionType;
      const owned = getOwnedProductIds(custId, ct);
      const missing = getMissingProducts(custId, ct);
      const wishlist = getWishlist(custId);
      const prefs = getPreferences(custId);
      return {
        customer: { ...customer, collectionType: ct },
        subscription: sub,
        ownedCount: owned.length,
        eligibleCount: missing.filter((p) => p.inventoryQty > 0).length,
        wishlistCount: wishlist.length,
        duplicateRisk: missing.filter((p) => p.inventoryQty > 0).length <= 3,
        preferences: prefs,
        nextShipmentDate: sub.nextShipmentDate,
        collectionType: ct,
      };
    })
    .sort((a, b) => a.nextShipmentDate.localeCompare(b.nextShipmentDate));
}

// ═══════════════════════════════════════════════════════════════
// EXPORTS — same interface as original mock-db
// ═══════════════════════════════════════════════════════════════

export {
  ELEMENTS_118, COLLECTION_TYPES,
  products, customers,
  getProducts, getProductById, getProductBySku,
  getCustomers, getCustomerById,
  getCustomerCollection, getOwnedProductIds, getOwnedElementSymbols,
  getMissingProducts,
  getWishlist, getWishlistProductIds,
  getSubscription, getShipments, getShippedProductIds,
  getPreferences,
  getExceptions, getPendingExceptions,
  getAdminNotes,
  getPricingHistory, getNotificationLog, getAdminSession,
  getCustomerStats, getDashboardStats, getUpcomingAssignments,
  isAvailableForCollection, isPreciousMetal, getAvailableCount,
  // New exports for Phase 2.5
  CATALOG_PRODUCTS, SUBSCRIPTION_PRODUCTS, getCollectionTypeStats,
  getCatalogProducts, getSubscriptionProducts,
  getAvailableElementCount,
};
