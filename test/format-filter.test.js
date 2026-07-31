/**
 * Regression tests — Bug 1: shop "Browse Products by Format" filter.
 *
 * Root cause: element `size` and `productsByFormat` keys were built straight
 * from the raw Shopify `periodic_size` metafield ("10mm", "50mm", …) but the
 * shop filtered by canonical ids ("10mm_cube", …). Only products whose
 * metafield happened to already be canonical (Fluorine, Rubidium) matched.
 *
 * These tests exercise the real transform (buildElements118) with a mix of
 * raw and canonical size tokens and assert the filter now returns every
 * eligible product — for 10mm_cube AND a second format (50mm_cube).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { buildElements118 } from "../app/data/elements-transform.server.js";
import { elementsForDisplayFormat, productForDisplayFormat } from "../app/lib/format-display.js";

/** Build a Shopify-shaped product node with one variant. */
function product({ name, sym, sizes, handle, sku }) {
  return {
    id: `gid://shopify/Product/${sym}`,
    handle: handle || name.toLowerCase(),
    title: name,
    variants: {
      edges: [
        {
          node: {
            id: `gid://shopify/ProductVariant/${sym}`,
            title: name,
            sku: sku || `${sym}-sku`,
            price: "49.99",
            inventoryQuantity: 5,
            availableForSale: true,
            elementSymbol: { value: sym },
            periodicPhase: { value: "solid" },
            periodicGroup: { value: "" },
            periodicRow: { value: null },
            periodicCol: { value: null },
            // Shopify list metafields are JSON-encoded arrays.
            periodic_size: { value: JSON.stringify(sizes) },
          },
        },
      ],
    },
  };
}

// A catalogue where MOST 10mm products use the raw token "10mm", while only
// two (Fluorine, Rubidium) use the canonical "10mm_cube" — reproducing prod.
const PRODUCTS = [
  product({ name: "Fluorine", sym: "F", sizes: ["10mm_cube"] }),
  product({ name: "Rubidium", sym: "Rb", sizes: ["10mm_cube"] }),
  product({ name: "Hydrogen", sym: "H", sizes: ["10mm"] }),
  product({ name: "Helium", sym: "He", sizes: ["10mm"] }),
  product({ name: "Lithium", sym: "Li", sizes: ["10mm", "50mm"] }),
  product({ name: "Gold", sym: "Au", sizes: ["50mm"] }),
  product({ name: "Carbon", sym: "C", sizes: ["ampoule"] }),
];

test("buildElements118 normalises size tokens and productsByFormat keys to canonical ids", () => {
  const elements = buildElements118(PRODUCTS);
  const h = elements.find((e) => e.sym === "H");
  assert.ok(h, "Hydrogen should be present");
  // Raw "10mm" must be stored canonically.
  assert.deepEqual(JSON.parse(h.size), ["10mm_cube"]);
  assert.ok(h.productsByFormat["10mm_cube"], "productsByFormat keyed canonically");
  assert.equal(h.productsByFormat["10mm"], undefined, "no raw key leaks through");
});

test("10mm Cube filter returns EVERY eligible product, not just Fluorine & Rubidium", () => {
  const elements = buildElements118(PRODUCTS);
  const shown = elementsForDisplayFormat(elements, "10mm_cube").map((e) => e.sym).sort();
  assert.deepEqual(shown, ["F", "H", "He", "Li", "Rb"]);
  assert.ok(shown.length > 2, "regression: more than the two hard-cases must show");
});

test("50mm Cube filter also works for its eligible products", () => {
  const elements = buildElements118(PRODUCTS);
  const shown = elementsForDisplayFormat(elements, "50mm_cube").map((e) => e.sym).sort();
  assert.deepEqual(shown, ["Au", "Li"]);
});

test("productForDisplayFormat resolves a product for a raw-token element", () => {
  const elements = buildElements118(PRODUCTS);
  const li = elements.find((e) => e.sym === "Li");
  assert.ok(productForDisplayFormat(li, "10mm_cube"), "Li available as 10mm cube");
  assert.ok(productForDisplayFormat(li, "50mm_cube"), "Li available as 50mm cube");
  assert.equal(productForDisplayFormat(li, "ampule"), null, "Li not offered as ampoule");
});

test("elements not offered in a format are excluded", () => {
  const elements = buildElements118(PRODUCTS);
  const tenmm = elementsForDisplayFormat(elements, "10mm_cube").map((e) => e.sym);
  assert.ok(!tenmm.includes("Au"), "Gold (50mm only) must not appear under 10mm");
  assert.ok(!tenmm.includes("C"), "Carbon (ampoule only) must not appear under 10mm");
});
