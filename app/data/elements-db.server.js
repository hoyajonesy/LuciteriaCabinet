/**
 * Luciteria Collector Cabinet — DB-backed element catalog builder (server-only)
 *
 * Converts rows from the Prisma `Product` table into canonical ELEMENTS_118
 * entries with the SAME shape produced by `buildElements118` in
 * ./elements-transform.server.js — so every existing ELEMENTS_118 consumer
 * (shop, wishlist, periodic table, formats.server, etc.) keeps working
 * unchanged.
 *
 * WHY DB instead of live Shopify metafields:
 * The previous pipeline built ELEMENTS_118 from a live Shopify GraphQL fetch
 * that relied on each variant's `periodic_size` custom metafield. In the real
 * store those metafields are almost entirely unpopulated / mis-tagged, so the
 * Shop only surfaced a couple of elements per format and the wishlist resolved
 * the wrong SKU for a given format (e.g. Gold "10mm Cube" pointed at an ampoule
 * priced $190 instead of the real 10mm mirror cube). The DB `Product` table is
 * the complete, synced source of truth (kept fresh by the Shopify sync
 * webhooks), so we build the catalog from it.
 *
 * Kept as a pure transform (rows in → elements out, no DB/network access) so it
 * can be unit-tested in isolation.
 */
import { CANONICAL_ELEMENTS, resolveCanonicalElement } from "./periodic-canonical.js";
import { normaliseFormat } from "../lib/formats.js";

const CANONICAL_BY_Z = new Map(CANONICAL_ELEMENTS.map((c) => [c.z, c]));

/**
 * Derive the canonical format id for a DB product row.
 * Uses the first token of the `collectionTypes` JSON array, falling back to the
 * raw `format` column, then normalises via normaliseFormat (e.g. "10mm" →
 * "10mm_cube", "lucite" → "lucite_cube", "ampoules" → "ampule").
 */
function canonicalFormatForRow(row) {
  let token = null;
  if (row.collectionTypes) {
    try {
      const parsed = JSON.parse(row.collectionTypes);
      if (Array.isArray(parsed) && parsed.length > 0) token = parsed[0];
    } catch {
      token = null;
    }
  }
  if (!token) token = row.format || null;
  return normaliseFormat(token);
}

/** Build the per-variant productData object consumed by the shop/wishlist. */
function productDataForRow(row) {
  return {
    productId: row.shopifyProductId || null,
    handle: row.handle || null,
    title: row.title || null,
    variantId: row.shopifyVariantId || null,
    variantTitle: null,
    sku: row.sku,
    size: row.format || null,
    price: typeof row.priceUsd === "number" ? row.priceUsd : Number(row.priceUsd) || 0,
    inventoryQty: typeof row.inventoryQty === "number" ? row.inventoryQty : Number(row.inventoryQty) || 0,
    availableForSale: row.status === "Active",
    row: null,
    col: null,
  };
}

/**
 * Deterministically choose the representative product for an (element, format)
 * slot from the candidate products in that format:
 *   1. Prefer Active (availableForSale) products.
 *   2. Among those, prefer in-stock (inventoryQty > 0).
 *   3. Tie-break: highest inventoryQty, then lowest price, then sku ascending.
 * If no Active product exists, still return the best candidate by the same
 * tie-breakers so the element still appears (as out-of-stock).
 */
function pickRepresentative(candidates) {
  const rank = (p) => [
    p.availableForSale ? 1 : 0,
    p.inventoryQty > 0 ? 1 : 0,
    p.inventoryQty,
  ];
  return [...candidates].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    for (let i = 0; i < ra.length; i++) {
      if (rb[i] !== ra[i]) return rb[i] - ra[i]; // higher is better
    }
    if (a.price !== b.price) return a.price - b.price; // lower price wins
    return String(a.sku).localeCompare(String(b.sku));
  })[0];
}

/**
 * Pure transform: DB Product rows → canonical ELEMENTS_118 entries.
 */
export function buildElements118FromDbRows(rows) {
  // Group everything by canonical atomic number.
  const byZ = new Map();

  for (const row of rows || []) {
    if (!row || !row.sku) continue;

    const formatId = canonicalFormatForRow(row);
    if (!formatId) continue; // no resolvable format → not a shoppable/format product

    // Resolve to the canonical periodic element (atomic number first, then
    // symbol/title as a fallback for rows with a missing/bad atomicNumber).
    let canonical = null;
    if (Number.isFinite(row.atomicNumber) && CANONICAL_BY_Z.has(row.atomicNumber)) {
      canonical = CANONICAL_BY_Z.get(row.atomicNumber);
    } else {
      canonical = resolveCanonicalElement(row.elementSymbol, row.title);
    }
    if (!canonical) {
      console.warn(
        `DB catalog: unresolved product skipped sku="${row.sku}" sym="${row.elementSymbol}" title="${row.title}"`
      );
      continue;
    }

    let el = byZ.get(canonical.z);
    if (!el) {
      el = {
        z: canonical.z,
        sym: canonical.sym,
        name: canonical.name,
        elementName: canonical.name,
        group: "",
        phase: "",
        row: canonical.row,
        col: canonical.col,
        sizes: new Set(),
        _candidatesByFormat: {},
        products: [],
      };
      byZ.set(canonical.z, el);
    }

    const pd = productDataForRow(row);
    el.products.push(pd);
    el.sizes.add(formatId);
    (el._candidatesByFormat[formatId] = el._candidatesByFormat[formatId] || []).push(pd);
  }

  return Array.from(byZ.values())
    .map((el) => {
      const productsByFormat = {};
      for (const [formatId, candidates] of Object.entries(el._candidatesByFormat)) {
        productsByFormat[formatId] = pickRepresentative(candidates);
      }
      return {
        z: el.z,
        sym: el.sym,
        name: el.name,
        elementName: el.elementName,
        group: el.group,
        phase: el.phase,
        row: el.row,
        col: el.col,
        size: JSON.stringify(Array.from(el.sizes).sort()),
        productsByFormat,
        products: el.products,
      };
    })
    .sort((a, b) => a.z - b.z);
}
