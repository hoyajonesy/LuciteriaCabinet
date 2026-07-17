/**
 * Shop Metafields Admin Tool — server helpers
 *
 * The shop's per-format element lists are driven entirely by each Shopify
 * product VARIANT's `custom.periodic_size` metafield. If that metafield is
 * missing or holds the wrong format id, the element is missing from (or shows
 * up under) the wrong format tab in the shop.
 *
 * This module reads every variant in the `periodic-table` collection, infers
 * the INTENDED format from the product/variant title + SKU, flags mismatches
 * against the current metafield value, and can WRITE corrections back via the
 * Shopify Admin `metafieldsSet` mutation.
 *
 * Credentials come from the app's own environment (SHOPIFY_SHOP /
 * SHOPIFY_ACCESS_TOKEN) — the same values used by app/data/elements.server.js —
 * so no secrets ever need to leave Vercel.
 */

import { FORMATS } from "./formats.js";

const SHOP = process.env.SHOPIFY_SHOP || "dcdwph-zm.myshopify.com";
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN || "";
const API_VERSION = "2025-10";
const COLLECTION_HANDLE = "periodic-table";

const VALID_FORMAT_IDS = new Set(Object.keys(FORMATS));

/** Low-level Shopify Admin GraphQL call. Throws on transport/GraphQL errors. */
async function shopGraphql(query, variables = {}) {
  if (!TOKEN) {
    throw new Error(
      "SHOPIFY_ACCESS_TOKEN is not set in this environment. This tool must be run where the Shopify credentials are configured (production)."
    );
  }

  const res = await fetch(
    `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Shopify-Access-Token": TOKEN,
      },
      body: JSON.stringify({ query, variables }),
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error ${res.status}: ${text}`);
  }

  const data = await res.json();
  if (data.errors) {
    throw new Error(`Shopify GraphQL errors: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

/**
 * Infer the intended format id from a variant's free-text signals.
 * Order matters: more specific tokens are checked before generic ones.
 * Returns a format id (e.g. "10mm_cube") or null when it can't be determined.
 */
export function inferFormatFromText({ productTitle = "", variantTitle = "", sku = "" } = {}) {
  const hay = `${productTitle} ${variantTitle} ${sku}`.toLowerCase();

  const has = (...tokens) => tokens.some((t) => hay.includes(t));

  // Shards / flakes boxes (10mm form factor) — check before plain "10mm".
  if (has("shard", "flake")) return "10mm_shards";

  // Lucite / acrylic embedments (SKU suffix "2x2", but title says lucite/acrylic).
  if (has("lucite", "acrylic", "embed")) return "lucite_cube";

  // Sealed glass ampoules.
  if (has("ampoule", "ampule", "-amp", " amp", "ampul")) return "ampule";

  // 50mm / 2-inch cubes (also SKU suffix "2x2") — check before 25.4/1-inch.
  if (has("50mm", "50 mm", "2 inch", "2-inch", '2"', "two inch")) return "50mm_cube";

  // 25.4mm / 1-inch cubes.
  if (has("25.4", "25mm", "1 inch", "1-inch", '1"', "one inch")) return "25.4mm_cube";

  // 10mm cubes (generic 10mm, after shards handled above).
  if (has("10mm", "10 mm")) return "10mm_cube";

  return null;
}

/** Parse a periodic_size metafield raw value into an array of format ids. */
function parseSizeValue(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [String(parsed)];
  } catch {
    return [String(raw)];
  }
}

/**
 * Fetch the metafield definition type for custom.periodic_size on variants.
 * We must reuse the existing type on writes or Shopify rejects the mutation.
 * Falls back to list.single_line_text_field (the conventional list type).
 */
export async function getPeriodicSizeType() {
  const query = `
    query {
      metafieldDefinitions(first: 1, namespace: "custom", key: "periodic_size", ownerType: PRODUCTVARIANT) {
        edges { node { type { name } } }
      }
    }
  `;
  try {
    const data = await shopGraphql(query);
    const t = data?.metafieldDefinitions?.edges?.[0]?.node?.type?.name;
    return t || "list.single_line_text_field";
  } catch {
    return "list.single_line_text_field";
  }
}

/** Format a metafield value string appropriate to the metafield type. */
function formatValueForType(type, formatId) {
  if (String(type).startsWith("list.")) {
    return JSON.stringify([formatId]);
  }
  return formatId;
}

/**
 * Load every variant in the periodic-table collection with its current
 * periodic_size metafield, plus the inferred (intended) format and a mismatch
 * classification.
 *
 * Returns { rows, buckets, generatedAt } where rows is a flat list and buckets
 * groups them into ok / needsFix / unknown for the UI.
 */
export async function loadVariantAudit() {
  const query = `
    query ($handle: String!, $cursor: String) {
      collectionByHandle(handle: $handle) {
        products(first: 100, after: $cursor) {
          edges {
            cursor
            node {
              id
              title
              handle
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    sku
                    elementSymbol: metafield(namespace: "custom", key: "element_symbol") { value }
                    periodicSize: metafield(namespace: "custom", key: "periodic_size") { id value type }
                  }
                }
              }
            }
          }
          pageInfo { hasNextPage }
        }
      }
    }
  `;

  const rows = [];
  let hasNextPage = true;
  let cursor = null;

  while (hasNextPage) {
    const data = await shopGraphql(query, { handle: COLLECTION_HANDLE, cursor });
    const collection = data?.collectionByHandle;
    if (!collection) {
      throw new Error(`Collection '${COLLECTION_HANDLE}' not found`);
    }
    const edges = collection.products?.edges || [];
    for (const { node: product } of edges) {
      for (const { node: variant } of product.variants?.edges || []) {
        const currentRaw = variant.periodicSize?.value || "";
        const current = parseSizeValue(currentRaw);
        const inferred = inferFormatFromText({
          productTitle: product.title,
          variantTitle: variant.title,
          sku: variant.sku,
        });

        let status;
        if (!inferred) {
          status = "unknown";
        } else if (current.length === 1 && current[0] === inferred) {
          status = "ok";
        } else {
          status = "needsFix";
        }

        rows.push({
          productId: product.id,
          productTitle: product.title,
          productHandle: product.handle,
          variantId: variant.id,
          variantTitle: variant.title,
          sku: variant.sku || "",
          symbol: variant.elementSymbol?.value || "",
          currentRaw,
          current,
          inferred,
          metafieldType: variant.periodicSize?.type || null,
          status,
        });
      }
    }
    hasNextPage = collection.products.pageInfo.hasNextPage;
    if (hasNextPage && edges.length > 0) {
      cursor = edges[edges.length - 1].cursor;
    } else {
      hasNextPage = false;
    }
  }

  rows.sort((a, b) => {
    const order = { needsFix: 0, unknown: 1, ok: 2 };
    if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
    return a.productTitle.localeCompare(b.productTitle);
  });

  const buckets = {
    needsFix: rows.filter((r) => r.status === "needsFix"),
    unknown: rows.filter((r) => r.status === "unknown"),
    ok: rows.filter((r) => r.status === "ok"),
  };

  return { rows, buckets, generatedAt: new Date().toISOString() };
}

/**
 * Write the periodic_size metafield for a single variant to [formatId].
 * Returns { ok, variantId, error }.
 */
export async function setVariantPeriodicSize(variantId, formatId, type) {
  if (!VALID_FORMAT_IDS.has(formatId)) {
    return { ok: false, variantId, error: `Invalid format id: ${formatId}` };
  }

  const mfType = type || (await getPeriodicSizeType());
  const value = formatValueForType(mfType, formatId);

  const mutation = `
    mutation ($metafields: [MetafieldsSetInput!]!) {
      metafieldsSet(metafields: $metafields) {
        metafields { id key namespace value type }
        userErrors { field message }
      }
    }
  `;

  const variables = {
    metafields: [
      {
        ownerId: variantId,
        namespace: "custom",
        key: "periodic_size",
        type: mfType,
        value,
      },
    ],
  };

  try {
    const data = await shopGraphql(mutation, variables);
    const errs = data?.metafieldsSet?.userErrors || [];
    if (errs.length) {
      return { ok: false, variantId, error: errs.map((e) => e.message).join("; ") };
    }
    return { ok: true, variantId };
  } catch (err) {
    return { ok: false, variantId, error: err.message };
  }
}

/**
 * Apply the inferred fix to a set of variant ids. Reloads the audit to know
 * each variant's inferred format + metafield type, then writes corrections.
 * Returns { results, fixed, failed }.
 */
export async function applyFixes(variantIds) {
  const wanted = new Set(variantIds);
  const { rows } = await loadVariantAudit();
  const mfType = await getPeriodicSizeType();

  const targets = rows.filter(
    (r) => wanted.has(r.variantId) && r.status === "needsFix" && r.inferred
  );

  const results = [];
  for (const t of targets) {
    // eslint-disable-next-line no-await-in-loop
    const res = await setVariantPeriodicSize(t.variantId, t.inferred, mfType);
    results.push({
      variantId: t.variantId,
      productTitle: t.productTitle,
      variantTitle: t.variantTitle,
      inferred: t.inferred,
      ...res,
    });
  }

  return {
    results,
    fixed: results.filter((r) => r.ok).length,
    failed: results.filter((r) => !r.ok).length,
  };
}
