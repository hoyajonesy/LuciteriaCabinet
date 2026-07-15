/**
 * Shared, framework-agnostic helpers for the subscription-tier admin form.
 *
 * These run on BOTH the client (live form validation, preview formatting) and
 * the server (the route action re-runs `validateTierForm` before persisting),
 * so this module must stay free of any server-only imports.
 */

/** Collection types the form is allowed to offer. Mirrors the DB validator. */
export const COLLECTION_TYPES = [
  { value: "10mm", label: "10mm Cubes" },
  { value: "25.4mm", label: "25.4mm (1 inch) Cubes" },
  { value: "50mm", label: "50mm Cubes" },
  { value: "lucite", label: "Lucite Blocks" },
  { value: "ampoules", label: "Ampoules" },
  { value: "ampule", label: "Ampules (single)" },
];

const VALID_COLLECTION_VALUES = COLLECTION_TYPES.map((c) => c.value);

/** Format a number as USD currency. */
export function formatCurrency(value) {
  const n = Number(value);
  if (!isFinite(n)) return "$0.00";
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

/** Format a 0..1 fraction as a percentage string (0.2 → "20%"). */
export function formatPercent(fraction) {
  const n = Number(fraction);
  if (!isFinite(n)) return "0%";
  return `${(n * 100).toFixed(n * 100 % 1 === 0 ? 0 : 1)}%`;
}

/** Convert a user-entered percent (e.g. "20" or "20.5") to a 0..1 fraction. */
export function percentToFraction(percent) {
  const n = Number(percent);
  if (!isFinite(n)) return 0;
  return Math.round(n * 100) / 10000; // keep 2 decimals of a percent
}

/** Convert a stored 0..1 fraction to a percent number for display in inputs. */
export function fractionToPercent(fraction) {
  const n = Number(fraction);
  if (!isFinite(n)) return 0;
  return Math.round(n * 10000) / 100;
}

/** Slugify a display name into a candidate tier key. */
export function slugifyKey(displayName) {
  return String(displayName || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

/**
 * Validate a raw tier form object. Returns a map of `{ field: message }`.
 * An empty object means the form is valid. Percentages here are the *fraction*
 * form (0..1) — convert display percents before calling.
 *
 * @param {Object} form
 * @param {Object} [opts]
 * @param {string[]} [opts.existingKeys] - other tiers' keys, to catch dupes
 * @returns {Record<string,string>}
 */
export function validateTierForm(form, { existingKeys = [] } = {}) {
  const errors = {};

  const key = (form.name || "").trim();
  if (!key) {
    errors.name = "Tier key is required.";
  } else if (!/^[a-z0-9][a-z0-9_.-]*$/i.test(key)) {
    errors.name = "Use letters, numbers, dot, dash or underscore (no spaces).";
  } else if (existingKeys.includes(key)) {
    errors.name = "This tier key is already in use.";
  }

  if (!form.displayName || !String(form.displayName).trim()) {
    errors.displayName = "Display name is required.";
  }

  const collectionTypes = Array.isArray(form.allowedCollectionTypes) ? form.allowedCollectionTypes : [];
  if (collectionTypes.length === 0) {
    errors.allowedCollectionTypes = "Select at least one collection type.";
  } else {
    const bad = collectionTypes.find((c) => !VALID_COLLECTION_VALUES.includes(c));
    if (bad) errors.allowedCollectionTypes = `Unknown collection type "${bad}".`;
  }

  const price = Number(form.monthlyPrice);
  if (!isFinite(price) || price <= 0) {
    errors.monthlyPrice = "Monthly price must be greater than 0.";
  }

  if (form.creditValue != null && form.creditValue !== "") {
    const credit = Number(form.creditValue);
    if (!isFinite(credit) || credit < 0) errors.creditValue = "Credit value cannot be negative.";
  }

  const disc = Number(form.discountPercentage);
  if (!isFinite(disc) || disc < 0 || disc > 1) {
    errors.discountPercentage = "Discount must be between 0% and 100%.";
  }

  if (form.displayOrder != null && form.displayOrder !== "") {
    const order = Number(form.displayOrder);
    if (!Number.isInteger(order) || order < 0) errors.displayOrder = "Display order must be a whole number ≥ 0.";
  }

  return errors;
}

/** Human-readable label for an audit action. */
export function auditActionLabel(action) {
  return {
    tier_created: "Created",
    tier_updated: "Updated",
    tier_deleted: "Deleted",
    tier_activated: "Activated",
    tier_deactivated: "Deactivated",
  }[action] || action;
}
