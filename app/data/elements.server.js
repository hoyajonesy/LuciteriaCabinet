/**
 * Luciteria Collector Cabinet — Complete Periodic Table Data
 * 
 * All 118 elements with standard periodic table positions,
 * collection type availability rules, and estimated pricing.
 * 
 * COLLECTION TYPE AVAILABILITY RULES:
 * - 10mm cubes: All except radioactives 84-103 (U is available)
 * - 25.4mm cubes: Exclude radioactives 84-103 except U, all gases, Li, As, Br, Ca, Ce, Eu, Hg, I, K, La, Na, Nd, Pr, Rb, Sr, Tl
 * - 50mm cubes: Same exclusions as 25.4mm
 * - Lucite cubes: All elements (full periodic table)
 * - Ampoules: All except radioactives 84-103 (U is available)
 * 
 * PRECIOUS METALS (excluded from subscription assignments):
 * Re, Rh, Au, Os, Ru, Pd, Ir, Pt (Ag is allowed)
 */

// Standard periodic table row/col positions
// Rows 1-7 = main table, row 9 = lanthanides, row 10 = actinides

import { CANONICAL_ELEMENTS } from "./periodic-canonical.js";
import { buildElements118 } from "./elements-transform.server.js";
import { buildElements118FromDbRows } from "./elements-db.server.js";
import { prisma } from "../lib/db.server.js";

export { buildElements118 };

/**
 * Build the canonical element catalog from the Prisma `Product` table.
 *
 * This is the source of truth for ELEMENTS_118 (replacing the older live
 * Shopify `periodic_size` metafield fetch, which was unreliable — see
 * elements-db.server.js for the rationale). The `Product` table is synced from
 * Shopify by the inventory/product webhooks, so it stays fresh.
 */
async function buildElements118FromDb() {
  const rows = await prisma.product.findMany();
  return buildElements118FromDbRows(rows);
}


async function fetchElements118() {
  const shop = process.env.SHOPIFY_SHOP || "dcdwph-zm.myshopify.com";
  const accessToken = process.env.SHOPIFY_ACCESS_TOKEN || "";
  const apiVersion = "2025-10";

  let products = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const query = `
      query ($handle: String!, $cursor: String) {
        collectionByHandle(handle: $handle) {
          products(first: 250, after: $cursor) {
            edges {
              cursor
              node {
                id
                handle
                title
                variants(first: 100) {
                  edges {
                    node {
                      id
                      title
                      sku
                      price
                      inventoryQuantity
                      availableForSale
                      elementSymbol: metafield(namespace: "custom", key: "element_symbol") {
                        value
                      }

                      periodicPhase: metafield(namespace: "custom", key: "periodic_phase") {
                        value
                      }

                      periodicGroup: metafield(namespace: "custom", key: "periodic_group") {
                        value
                      }

                      periodicRow: metafield(namespace: "custom", key: "periodic_row") {
                        value
                      }

                      periodicCol: metafield(namespace: "custom", key: "periodic_col") {
                        value
                      }
                        periodic_size: metafield(namespace: "custom", key: "periodic_size") {
                        value
                      }
                    }
                  }
                }
              }
            }
            pageInfo {
              hasNextPage
            }
          }
        }
      }
    `;

    try {
      const response = await fetch(
        `https://${shop}/admin/api/${apiVersion}/graphql.json`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Shopify-Access-Token": accessToken,
          },
          body: JSON.stringify({
            query,
            variables: {
              handle: "periodic-table",
              cursor,
            },
          }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        console.error(`Shopify API error! Status: ${response.status}`, text);
        break;
      }

      const data = await response.json();

      if (data.errors) {
        console.error("Shopify GraphQL errors:", data.errors);
        break;
      }

      const collection = data.data?.collectionByHandle;

      if (!collection) {
        console.error("Collection 'periodic-table' not found");
        break;
      }

      const edges = collection.products?.edges || [];

      for (const edge of edges) {
        products.push(edge.node);
      }

      hasNextPage = collection.products.pageInfo.hasNextPage;

      if (hasNextPage && edges.length > 0) {
        cursor = edges[edges.length - 1].cursor;
      }
    } catch (err) {
      console.error("Error fetching elements:", err);
      break;
    }
  }

  return buildElements118(products);
}


// Minimal group/phase metadata for elements that Shopify may not return
// (so backfilled placeholders still color/label correctly).
const BACKFILL_META = {
  Rn: { group: "Noble Gas", phase: "gas" },
};

/**
 * Ensure every element of the canonical periodic table is present.
 *
 * ELEMENTS_118 is built from live Shopify products, so any element Luciteria
 * does not sell (e.g. Radon — a radioactive noble gas) would otherwise be
 * missing from every periodic-table view. We backfill those gaps with
 * placeholder entries that carry NO products (so they can't be purchased and
 * are excluded from format-specific/shop views), but DO render on the full
 * periodic table and remain selectable — letting collectors log specimens
 * they own from other sources.
 */
function backfillCanonicalElements(fetched) {
  const byZ = new Map(fetched.map((e) => [e.z, e]));
  for (const c of CANONICAL_ELEMENTS) {
    if (byZ.has(c.z)) continue;
    const meta = BACKFILL_META[c.sym] || {};
    byZ.set(c.z, {
      z: c.z,
      sym: c.sym,
      name: c.name,
      elementName: c.name,
      group: meta.group || "",
      phase: meta.phase || "",
      row: c.row,
      col: c.col,
      // No Shopify sizes/products → filtered out of shop & format views,
      // but present on the full periodic table.
      size: "[]",
      productsByFormat: {},
      products: [],
    });
  }
  return Array.from(byZ.values()).sort((a, b) => a.z - b.z);
}

const ELEMENTS_118 = backfillCanonicalElements(await buildElements118FromDb());









// ─── COLLECTION TYPE DEFINITIONS ────────────────────────────
const COLLECTION_TYPES = {
  "10mm_cube": {
    id: "10mm_cube",
    label: "10mm Cubes",
    description: "Compact metal cubes — perfect for starting your journey",
    priceUsd: 49.99,
    skuSuffix: "10mm",
  },
  "25.4mm_cube": {
    id: "25.4mm_cube",
    label: "25.4mm Cubes",
    description: "One-inch cubes — the collector's sweet spot",
    priceUsd: 79.99,
    skuSuffix: "25.4mm",
  },
  "50mm_cube": {
    id: "50mm_cube",
    label: "50mm Cubes",
    description: "Statement pieces — substantial, impressive, unmistakable",
    priceUsd: 99.99,
    skuSuffix: "2x2",
  },
  "lucite_cube": {
    id: "lucite_cube",
    label: "Lucite Cubes",
    description: "Elements preserved in crystal-clear acrylic — the flagship experience",
    priceUsd: 129.99,
    skuSuffix: "2x2",
  },
  "ampule": {
    id: "ampule",
    label: "Ampoules",
    description: "Sealed glass ampoules — for gases and reactive elements",
    priceUsd: 69.99,
    skuSuffix: "amp",
  },
};

// ─── AVAILABILITY RULES PER COLLECTION TYPE ─────────────────
// Radioactives 84-103 (Po through Lr), except Uranium (92) is available for 10mm and ampoules
const RADIOACTIVES_84_103 = [84, 85, 86, 87, 88, 89, 90, 91, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103];
// Gas-phase elements
const GAS_ELEMENTS = [1, 2, 7, 8, 9, 10, 17, 18, 36, 54, 86];
// Special exclusions for 25.4mm and 50mm
const CUBE_EXCLUSIONS = ["Li", "As", "Br", "Ca", "Ce", "Eu", "Hg", "I", "K", "La", "Na", "Nd", "Pr", "Rb", "Sr", "Tl"];
const CUBE_EXCLUSION_Z = [3, 33, 35, 20, 58, 63, 80, 53, 19, 57, 11, 60, 59, 37, 38, 81];

// Precious metals excluded from subscription assignments (but can be purchased)
const PRECIOUS_METALS = ["Re", "Rh", "Au", "Os", "Ru", "Pd", "Ir", "Pt"];
const PRECIOUS_METALS_Z = [75, 45, 79, 76, 44, 46, 77, 78];

/**
 * Check if an element is available for a given collection type
 */
function isAvailableForCollection(atomicNumber, collectionType) {
  switch (collectionType) {
    case "10mm_cube":
    case "ampule":
      // All except radioactives 84-103 (U=92 is available)
      return !RADIOACTIVES_84_103.includes(atomicNumber);

    case "25.4mm_cube":
    case "50mm_cube":
      // Exclude radioactives 84-103 except U, all gases, plus special list
      if (RADIOACTIVES_84_103.includes(atomicNumber)) return false;
      if (GAS_ELEMENTS.includes(atomicNumber)) return false;
      if (CUBE_EXCLUSION_Z.includes(atomicNumber)) return false;
      return true;

    case "lucite_cube":
      // All elements available (full periodic table)
      return true;

    default:
      return true;
  }
}

/**
 * Check if element is a precious metal (excluded from subscription)
 */
function isPreciousMetal(symbol) {
  return PRECIOUS_METALS.includes(symbol);
}

/**
 * Get total available elements count for a collection type
 */
function getAvailableCount(collectionType) {
  return ELEMENTS_118.filter(e => isAvailableForCollection(e.z, collectionType)).length;
}

/**
 * Get group color for periodic table visualization
 */
function getGroupColor(group) {
  const colors = {
    "Alkali Metal": "#e8425c",
    "Alkaline Earth": "#f58442",
    "Transition Metal": "#4a90e2",
    "Post-Transition Metal": "#45b7d1",
    "Metalloid": "#6c5ce7",
    "Nonmetal": "#00b894",
    "Halogen": "#fdcb6e",
    "Noble Gas": "#a29bfe",
    "Lanthanide": "#fd79a8",
    "Actinide": "#fab1a0",
  };
  return colors[group] || "#888";
}

export {
  ELEMENTS_118,
  COLLECTION_TYPES,
  PRECIOUS_METALS,
  PRECIOUS_METALS_Z,
  RADIOACTIVES_84_103,
  GAS_ELEMENTS,
  CUBE_EXCLUSION_Z,
  isAvailableForCollection,
  isPreciousMetal,
  getAvailableCount,
  getGroupColor,
};
