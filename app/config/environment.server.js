/**
 * Luciteria Collector Cabinet — Environment Configuration
 *
 * Validates required env vars, exports typed config, and provides
 * feature flags for toggling prototype vs production behaviour.
 *
 * IMPORTANT FOR DEVELOPER:
 * When integrating with real Shopify, switch APP_MODE to "production"
 * and provide all SHOPIFY_* variables in .env. The app will then use
 * real API calls instead of mock data.
 */

// ─── APP MODE ────────────────────────────────────────────────

/** @type {"prototype" | "production"} */
export const APP_MODE = process.env.APP_MODE || "prototype";
export const IS_PROTOTYPE = APP_MODE === "prototype";
export const IS_PRODUCTION = APP_MODE === "production";
export const NODE_ENV = process.env.NODE_ENV || "development";

// ─── DATABASE ────────────────────────────────────────────────

export const DATABASE_URL = process.env.DATABASE_URL || "file:./dev.db";

// ─── SESSION ─────────────────────────────────────────────────

export const SESSION_SECRET = process.env.SESSION_SECRET || "dev-secret-change-me";

// ─── SHOPIFY ─────────────────────────────────────────────────

export const SHOPIFY_CONFIG = {
  apiKey: process.env.SHOPIFY_API_KEY || "",
  apiSecret: process.env.SHOPIFY_API_SECRET || "",
  shopDomain: process.env.SHOPIFY_SHOP_DOMAIN || process.env.SHOPIFY_SHOP || "",
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN || "",
  storefrontToken: process.env.SHOPIFY_STOREFRONT_TOKEN || "",
  webhookSecret: process.env.SHOPIFY_WEBHOOK_SECRET || "",
  apiVersion: process.env.SHOPIFY_API_VERSION || "2024-10",
  scopes: (process.env.SCOPES || "").split(",").filter(Boolean),
};

// ─── EMAIL / NOTIFICATIONS ───────────────────────────────────

export const EMAIL_CONFIG = {
  provider: process.env.EMAIL_SERVICE_PROVIDER || "none",
  apiKey: process.env.EMAIL_SERVICE_API_KEY || "",
  fromAddress: process.env.EMAIL_FROM_ADDRESS || "noreply@luciteria.com",
  fromName: process.env.EMAIL_FROM_NAME || "Luciteria",
};

// ─── FEATURE FLAGS ───────────────────────────────────────────

function envBool(key, defaultVal = false) {
  const val = process.env[key];
  if (val === undefined) return defaultVal;
  return val === "true" || val === "1";
}

export const FEATURES = {
  assignmentEngine: envBool("FEATURE_ASSIGNMENT_ENGINE", true),
  discountAlerts: envBool("FEATURE_DISCOUNT_ALERTS", true),
  preciousMetalExclusion: envBool("FEATURE_PRECIOUS_METAL_EXCLUSION", true),
  grandfathering: envBool("FEATURE_GRANDFATHERING", true),
  emailNotifications: envBool("FEATURE_EMAIL_NOTIFICATIONS", false),
  webhookSync: envBool("FEATURE_WEBHOOK_SYNC", false),
  multiCollection: envBool("FEATURE_MULTI_COLLECTION", false),
};

// ─── PRICING DEFAULTS ────────────────────────────────────────

export const PRICING_DEFAULTS = {
  lucite: parseFloat(process.env.PRICE_LUCITE_MONTHLY) || 79.99,
  "10mm": parseFloat(process.env.PRICE_10MM_MONTHLY) || 49.99,
  "25.4mm": parseFloat(process.env.PRICE_25MM_MONTHLY) || 69.99,
  "50mm": parseFloat(process.env.PRICE_50MM_MONTHLY) || 99.99,
  ampoules: parseFloat(process.env.PRICE_AMPOULES_MONTHLY) || 59.99,
};

// ─── DISCOUNT THRESHOLDS ─────────────────────────────────────

export const DISCOUNT_ALERT_THRESHOLD =
  parseFloat(process.env.DISCOUNT_ALERT_THRESHOLD) || 0.20;
export const DISCOUNT_HARD_CAP =
  parseFloat(process.env.DISCOUNT_HARD_CAP) || 0.35;
export const GRANDFATHER_DEFAULT_MONTHS =
  parseInt(process.env.GRANDFATHER_DEFAULT_MONTHS, 10) || 12;

// ─── LOGGING ─────────────────────────────────────────────────

export const LOG_LEVEL = process.env.LOG_LEVEL || "info";
export const LOG_FORMAT = process.env.LOG_FORMAT || "text";

// ─── VALIDATION ──────────────────────────────────────────────

/**
 * Validate that all required env vars are present for the current APP_MODE.
 * Call this once at server startup.
 *
 * @returns {{ valid: boolean, errors: string[] }}
 */
export function validateEnvironment() {
  const errors = [];

  if (IS_PRODUCTION) {
    // Shopify credentials are required in production
    if (!SHOPIFY_CONFIG.apiKey) errors.push("SHOPIFY_API_KEY is required in production mode");
    if (!SHOPIFY_CONFIG.apiSecret) errors.push("SHOPIFY_API_SECRET is required in production mode");
    if (!SHOPIFY_CONFIG.shopDomain) errors.push("SHOPIFY_SHOP_DOMAIN is required in production mode");
    if (!SHOPIFY_CONFIG.accessToken) errors.push("SHOPIFY_ACCESS_TOKEN is required in production mode");
    if (!SHOPIFY_CONFIG.webhookSecret) errors.push("SHOPIFY_WEBHOOK_SECRET is required in production mode");

    // Database must be PostgreSQL in production
    if (DATABASE_URL.includes("file:")) {
      errors.push("DATABASE_URL must be a PostgreSQL connection string in production (not SQLite)");
    }

    // Session secret must not be the default
    if (SESSION_SECRET === "dev-secret-change-me") {
      errors.push("SESSION_SECRET must be changed from default in production");
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Log current configuration (redacting secrets).
 * Useful for debugging startup issues.
 */
export function logConfig() {
  console.log("[config] App Mode:", APP_MODE);
  console.log("[config] Node Env:", NODE_ENV);
  console.log("[config] Database:", DATABASE_URL.includes("file:") ? "SQLite" : "PostgreSQL");
  console.log("[config] Shopify:", SHOPIFY_CONFIG.shopDomain || "(not configured)");
  console.log("[config] Features:", JSON.stringify(FEATURES));
}
