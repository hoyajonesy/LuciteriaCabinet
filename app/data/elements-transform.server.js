/**
 * Luciteria Collector Cabinet — Pure element transform (server-only)
 *
 * Converts raw Shopify product nodes into canonical ELEMENTS_118 entries.
 * Kept in its own module (with NO top-level Shopify fetch) so the transform
 * can be unit-tested without network access.
 */
import { resolveCanonicalElement } from "./periodic-canonical.js";
import { normaliseFormat } from "../lib/formats.js";

/**
 * Pure transform: raw Shopify product nodes → canonical ELEMENTS_118 entries.
 * Exported so it can be unit-tested without hitting the Shopify API.
 *
 * Every periodic_size token is normalised to its canonical format id via
 * normaliseFormat() so that both `sizes`/`size` and the `productsByFormat`
 * keys use the same canonical vocabulary the app filters against
 * (e.g. "10mm" → "10mm_cube", "50mm" → "50mm_cube"). This is the fix for the
 * shop filter only matching products whose raw metafield happened to already
 * be canonical.
 */
export function buildElements118(products) {
  // Create one element per symbol, while preserving every product/variant format.
  // Shopify can return the same element symbol for multiple periodic_size values;
  // the frontend uses productsByFormat to swap product data when the format changes.
  const elementsBySymbol = new Map();

  products.forEach((product) => {
    product.variants.edges.forEach(({ node: variant }) => {
      const symbol = variant.elementSymbol?.value;

      // Skip empty symbols
      if (!symbol) return;

      const rawSize = variant.periodic_size?.value || "";
      let sizes = [];
      if (rawSize) {
        try {
          const parsed = JSON.parse(rawSize);
          sizes = Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
        } catch {
          sizes = [rawSize];
        }
      }
      // Normalise every raw size token to its canonical format id so the shop
      // filter (and every other productsByFormat consumer) matches correctly,
      // regardless of whether Shopify stored "10mm", "10mm_cube", "50mm", etc.
      sizes = sizes.map((s) => normaliseFormat(s)).filter(Boolean);

      const productData = {
        productId: product.id,
        handle: product.handle,
        title: product.title,
        variantId: variant.id,
        variantTitle: variant.title,
        sku: variant.sku,
        size: rawSize,
        price: variant.price ? parseFloat(variant.price) : 0,
        inventoryQty: variant.inventoryQuantity || 0,
        availableForSale: variant.availableForSale ?? false,
        row: variant.periodicRow?.value ? Number(variant.periodicRow.value) : null,
        col: variant.periodicCol?.value ? Number(variant.periodicCol.value) : null,
      };

      if (!elementsBySymbol.has(symbol)) {
        elementsBySymbol.set(symbol, {
          sym: symbol,
          name: product.title,
          group: variant.periodicGroup?.value || "",
          phase: variant.periodicPhase?.value || "",
          row: Number(variant.periodicRow?.value) || 1,
          col: Number(variant.periodicCol?.value) || 1,
          sizes: new Set(),
          productsByFormat: {},
          products: [],
        });
      }

      const element = elementsBySymbol.get(symbol);
      element.products.push(productData);

      sizes.forEach((size) => {
        element.sizes.add(size);
        if (!element.productsByFormat[size]) {
          element.productsByFormat[size] = productData;
        }
      });
    });
  });

  // Resolve every Shopify element to the canonical periodic table by NAME
  // (product title) first, then symbol. This corrects unreliable Shopify
  // metafields: lowercase symbols ("ge"), wrong symbols (Osmium tagged "Og"),
  // and size-laden titles. Elements that can't be confidently resolved are
  // dropped so they don't render as stray cells. Multiple Shopify entries that
  // resolve to the same element are merged into one (dedup by atomic number),
  // preserving all product/variant formats.
  const byZ = new Map();

  for (const element of elementsBySymbol.values()) {
    const title = element.name || element.products?.[0]?.title || "";
    const canonical = resolveCanonicalElement(element.sym, title);
    if (!canonical) {
      console.warn(`Unresolved element skipped: sym="${element.sym}" title="${title}"`);
      continue;
    }

    let merged = byZ.get(canonical.z);
    if (!merged) {
      merged = {
        z: canonical.z,
        sym: canonical.sym,
        // Clean element name (canonical) — no size tokens like "50mm".
        name: canonical.name,
        elementName: canonical.name,
        group: element.group,
        phase: element.phase,
        // Standard, deterministic layout position.
        row: canonical.row,
        col: canonical.col,
        sizes: new Set(),
        productsByFormat: {},
        products: [],
      };
      byZ.set(canonical.z, merged);
    }

    if (!merged.group && element.group) merged.group = element.group;
    if (!merged.phase && element.phase) merged.phase = element.phase;
    for (const p of element.products) merged.products.push(p);
    for (const size of element.sizes) {
      merged.sizes.add(size);
      if (!merged.productsByFormat[size]) {
        merged.productsByFormat[size] = element.productsByFormat[size];
      }
    }
  }

  return Array.from(byZ.values())
    .map((element) => ({
      z: element.z,
      sym: element.sym,
      name: element.name,
      elementName: element.elementName,
      group: element.group,
      phase: element.phase,
      row: element.row,
      col: element.col,
      size: JSON.stringify(Array.from(element.sizes)),
      productsByFormat: element.productsByFormat,
      products: element.products,
    }))
    .sort((a, b) => a.z - b.z);
}
