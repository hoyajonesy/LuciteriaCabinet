/**
 * Luciteria Collector Cabinet — Application Constants
 *
 * Centralised magic numbers, business rules, and configuration values.
 * Import from here instead of hardcoding throughout the codebase.
 */

// ─── COLLECTION TYPES ────────────────────────────────────────

export const COLLECTION_TYPE_IDS = ["lucite", "10mm", "25.4mm", "50mm", "ampoules"];

export const COLLECTION_TYPE_LABELS = {
  lucite: "Lucite 50mm Cubes",
  "10mm": "10mm Metal Cubes",
  "25.4mm": "25.4mm (1 inch) Cubes",
  "50mm": "50mm Metal Cubes",
  ampoules: "Sealed Ampoules",
};

export const COLLECTION_TYPE_ICONS = {
  lucite: "🧊",
  "10mm": "🔲",
  "25.4mm": "📐",
  "50mm": "🧱",
  ampoules: "🧪",
};

// ─── PERIODIC TABLE ──────────────────────────────────────────

export const TOTAL_ELEMENTS = 118;

/**
 * Precious metals excluded from automatic subscription assignment.
 * These can only be purchased outright or assigned via admin override.
 */
export const PRECIOUS_METAL_SYMBOLS = new Set([
  "Re", "Rh", "Au", "Os", "Ru", "Pd", "Ir", "Pt",
]);

/** Silver is allowed in subscriptions (business decision). */
export const PRECIOUS_ALLOWED_SYMBOLS = new Set(["Ag"]);

// ─── PRICING ─────────────────────────────────────────────────

/** Discount above this triggers admin alert. */
export const DISCOUNT_ALERT_THRESHOLD = 0.20;

/** Hard cap — never auto-assign if discount exceeds this. */
export const DISCOUNT_HARD_CAP = 0.35;

/** Default grandfathering lock period in months. */
export const GRANDFATHER_MONTHS = 12;

/** Billing edge case: signups within first N days use signup-day billing. */
export const BILLING_EDGE_CASE_DAYS = 5;

// ─── SUBSCRIPTION PLANS ─────────────────────────────────────

export const PLAN_TIERS = {
  basic: { name: "Element Explorer", itemsPerShipment: 1 },
  premium: { name: "Collector", itemsPerShipment: 1 },
  ultimate: { name: "Completionist", itemsPerShipment: 1 },
};

export const BILLING_CADENCES = ["monthly", "quarterly", "annual"];

// ─── ASSIGNMENT ENGINE ──────────────────────────────────────

export const ASSIGNMENT_STRATEGIES = {
  OLDEST_MISSING: "oldest_missing",
  HIGHEST_OVERSTOCK: "highest_overstock",
  CURATED_LIST: "curated_list",
  CATEGORY_ROTATION: "category_rotation",
  SURPRISE: "surprise",
  WISHLIST_PRIORITY: "wishlist_priority",
};

export const DUPLICATE_MODES = {
  NEVER: "never",
  MISSING_ONLY: "missing_only",
  CURATED_SUBS: "curated_subs",
  ALLOW_IF_LIMITED: "allow_if_limited",
  SURPRISE: "surprise",
};

/** Default number of future assignments to preview. */
export const SEQUENCE_PREVIEW_COUNT = 4;

/** Low stock threshold — products below this trigger alerts. */
export const LOW_STOCK_THRESHOLD = 3;

// ─── RARITY TIERS ────────────────────────────────────────────

export const RARITY_TIERS = ["common", "uncommon", "rare", "ultra-rare", "legendary"];

export const RARITY_COLORS = {
  common: "#6b7280",
  uncommon: "#4A90E2",
  rare: "#d97706",
  "ultra-rare": "#dc2626",
  legendary: "#7c3aed",
};

// ─── UI DEFAULTS ─────────────────────────────────────────────

export const DEFAULT_CUSTOMER_ID = "cust_001";
export const DEFAULT_PAGE_SIZE = 20;
export const ADMIN_NAV_WIDTH = 240;

// ─── SHOPIFY INTEGRATION ────────────────────────────────────

/**
 * Metafield namespaces used to store collection data in Shopify.
 * In production the developer should create these metafield definitions
 * via the Shopify Admin API or in Settings → Custom data.
 */
export const SHOPIFY_METAFIELD_NAMESPACES = {
  collection: "luciteria_collection",
  assignment: "luciteria_assignment",
  preferences: "luciteria_preferences",
};

/**
 * Shopify webhook topics the app needs to subscribe to.
 */
export const SHOPIFY_WEBHOOK_TOPICS = [
  "PRODUCTS_UPDATE",
  "PRODUCTS_DELETE",
  "INVENTORY_LEVELS_UPDATE",
  "CUSTOMERS_CREATE",
  "CUSTOMERS_UPDATE",
  "CUSTOMERS_DELETE",
  "ORDERS_CREATE",
  "ORDERS_PAID",
  "ORDERS_FULFILLED",
  "SUBSCRIPTION_CONTRACTS_CREATE",
  "SUBSCRIPTION_CONTRACTS_UPDATE",
  "APP_UNINSTALLED",
];
