/**
 * Luciteria Collector Cabinet — Database-backed Format Service
 *
 * The admin `Format` table is the SINGLE SOURCE OF TRUTH for the collection
 * formats offered across the whole app: onboarding, add-to-collection (element
 * notes / samples), add-to-wishlist, and the ledger. Activating, renaming,
 * re-ordering, or mapping a format in Admin → Formats instantly changes every
 * user-facing surface.
 *
 * Each format row has:
 *   - name        display label shown to users
 *   - key         stable machine value stored on samples / prefs (never shown)
 *   - shopifyKey  optional mapping to a Shopify `periodic_size` value. When set
 *                 the format is "purchasable" and resolves to real products
 *                 (price + stock). Null => personal-only format.
 *
 * The client-safe Shopify-size catalog (FORMATS in ./formats.js) still defines
 * the periodic_size metafield universe and is bridged to the DB via shopifyKey.
 */

import { prisma } from "./db.server.js";

/**
 * All formats, ordered for display. Admin management shows every row.
 */
export async function getAllFormats() {
  return prisma.format.findMany({ orderBy: { displayOrder: "asc" } });
}

/**
 * Active formats only — this is what every user-facing selector should use.
 * Returned as plain option objects.
 */
export async function getActiveFormats() {
  const rows = await prisma.format.findMany({
    where: { isActive: true },
    orderBy: { displayOrder: "asc" },
  });
  return rows.map((f) => ({
    id: f.key,               // selectors submit the stable key as the value
    key: f.key,
    name: f.name,
    description: f.description || "",
    shopifyKey: f.shopifyKey || null,
    purchasable: !!f.shopifyKey,
  }));
}

/**
 * Convenience lookup maps built from ALL formats (active + inactive) so that
 * previously-saved values still render even if a format was later deactivated.
 *
 * Returns:
 *   labelByKey     { [key]: name }
 *   shopifyByKey   { [key]: shopifyKey|null }
 *   keyByShopify   { [shopifyKey]: key }
 *   activeKeys     Set of currently-active keys
 */
export async function getFormatMaps() {
  const rows = await prisma.format.findMany({ orderBy: { displayOrder: "asc" } });
  const labelByKey = {};
  const shopifyByKey = {};
  const keyByShopify = {};
  const activeKeys = new Set();
  for (const f of rows) {
    labelByKey[f.key] = f.name;
    shopifyByKey[f.key] = f.shopifyKey || null;
    if (f.shopifyKey) keyByShopify[f.shopifyKey] = f.key;
    if (f.isActive) activeKeys.add(f.key);
  }
  return { labelByKey, shopifyByKey, keyByShopify, activeKeys, rows };
}

/**
 * Resolve any stored format value to a human display label.
 * Handles: canonical keys ("other"), legacy Shopify-convention values
 * ("lucite_cube") saved before the unification, and unknown values (shown raw).
 */
export function formatLabel(value, maps) {
  if (!value) return "—";
  if (maps?.labelByKey?.[value]) return maps.labelByKey[value];
  if (maps?.keyByShopify?.[value] && maps.labelByKey[maps.keyByShopify[value]]) {
    return maps.labelByKey[maps.keyByShopify[value]];
  }
  return value; // unknown/legacy free-text — show as-is rather than dropping it
}

/**
 * The collector's preferred/default format key, derived from onboarding.
 * Subscribers -> their subscription format; collectors -> first tracked format.
 * Only returns a key that is still active (so a deactivated format never
 * pre-selects). Returns "" when nothing suitable is found.
 *
 * @param {object} user       auth user record (subscriptionFormat, trackedFormats)
 * @param {Set}    activeKeys  set of currently-active format keys
 */
export function preferredFormatKey(user, activeKeys) {
  const candidates = [];
  if (user?.subscriptionFormat) candidates.push(user.subscriptionFormat);
  try {
    const tracked = JSON.parse(user?.trackedFormats || "[]");
    if (Array.isArray(tracked)) candidates.push(...tracked);
  } catch {
    /* ignore malformed JSON */
  }
  for (const c of candidates) {
    if (c && (!activeKeys || activeKeys.has(c))) return c;
  }
  return "";
}

/**
 * The Shopify `periodic_size` value a stored format key maps to (for product /
 * price / stock lookups). Falls back to treating the value as already being a
 * Shopify key (legacy data) when no explicit mapping exists.
 */
export function shopifyKeyForFormat(value, maps) {
  if (!value) return null;
  if (maps?.shopifyByKey?.[value] !== undefined) return maps.shopifyByKey[value];
  return value;
}
