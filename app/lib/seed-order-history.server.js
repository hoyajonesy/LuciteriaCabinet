/**
 * Seed Order History — Subscription Onboarding
 * 
 * Implements FR-2, FR-8: Extract ownership evidence from Shopify order history
 * using SKU-based stable identity matching.
 * 
 * FR-2: Each sold product/variant is assigned a stable, canonical ownable-unit
 * identity at time of sale (preserved in DB Product table via sync webhooks).
 * 
 * FR-8: Paid + fulfilled line items from order history count as ownership evidence.
 * Refunded, cancelled, unfulfilled orders do not count.
 */

import { prisma } from "./db.server.js";
import { OWNERSHIP_SOURCE } from "./ownership-provenance.server.js";
import { shopifyClient } from "../integrations/shopify/shopify-client.server.js";
import { logger } from "./error-handling.server.js";

const MODULE = "seed-order-history";

/**
 * GraphQL query for a customer's prior orders. We only ask for the fields we
 * need to establish FR-8 ownership evidence: financial + fulfillment status and
 * each line item's variant SKU (the FR-2 stable identity anchor).
 */
const CUSTOMER_ORDERS_QUERY = `
query OnboardingCustomerOrders($query: String!, $cursor: String) {
  orders(first: 50, after: $cursor, query: $query, sortKey: PROCESSED_AT) {
    edges {
      cursor
      node {
        id
        displayFinancialStatus
        displayFulfillmentStatus
        lineItems(first: 100) {
          edges {
            node {
              quantity
              variant { sku legacyResourceId }
            }
          }
        }
      }
    }
    pageInfo { hasNextPage endCursor }
  }
}`;

/**
 * Derive canonical format from SKU using the same rules as elements-db.server.js
 */
export function canonicalFormatFromSku(sku) {
  const skuLower = (sku || "").toLowerCase();
  if (!skuLower) return null;

  // 10mm Box (Shards/Flakes)
  if (skuLower.endsWith("10mm_sg") || skuLower.endsWith("10.1mm") || 
      skuLower.endsWith("10.1mm_0.1g") || skuLower.endsWith("10.1mm_1g")) {
    return "10mm_shards";
  }

  // 10mm Cube
  if (skuLower.endsWith("10mm")) {
    return "10mm_cube";
  }

  // 25.4mm Cube
  if (skuLower.endsWith("25.4mm")) {
    return "25.4mm_cube";
  }

  // 50mm Cube
  if (skuLower.endsWith("50mm")) {
    return "50mm_cube";
  }

  // Lucite Cube
  if (skuLower.endsWith("2x2")) {
    return "lucite_cube";
  }

  // Ampoule
  if (skuLower.includes("15x60mm") || skuLower.includes("_amp") || 
      skuLower.endsWith("_bot") || skuLower.endsWith("_bar") || 
      skuLower.includes("_bead") || skuLower.includes("_den")) {
    return "ampule";
  }

  return "other";
}

/**
 * Extract element symbol from SKU (first 1-2 letters before numbers/underscores)
 */
function elementSymbolFromSku(sku) {
  const match = sku.match(/^([A-Z][a-z]?)/i);
  return match ? match[1] : null;
}

/**
 * Seed ownership suggestions from Shopify order history for a specific format track.
 * Returns array of { elementSymbol, format, sku, title } for suggested items.
 * 
 * FR-8: Only paid + fulfilled line items count. Refunded/cancelled don't count.
 */
export async function seedFromOrderHistory(shopifyCustomerId, formatTrack) {
  if (!shopifyCustomerId) return [];

  // Resolve the format track once (e.g. "10mm" → "10mm_cube", "lucite" → "lucite_cube").
  const trackNormalized = formatTrack.replace("mm", "mm_cube").replace("lucite", "lucite_cube");
  const matchesTrack = (fmt) => fmt && (fmt === trackNormalized || fmt === formatTrack);

  // ─── FR-9/FR-8: fetch the customer's REAL prior order history ───
  // Ownership evidence comes from the subscriber's actual paid + fulfilled
  // orders — NOT from the full active-product catalog. Seeding from the catalog
  // would fabricate "you own this" suggestions for items the subscriber never
  // bought, which is exactly the false-positive this feature must avoid.
  const numericCustomerId = String(shopifyCustomerId).split("/").pop();
  const searchQuery = `customer_id:${numericCustomerId} financial_status:paid fulfillment_status:fulfilled`;

  const purchasedSkus = new Set();
  try {
    let cursor = null;
    let pages = 0;
    const MAX_PAGES = 20; // safety bound on pagination
    // eslint-disable-next-line no-constant-condition
    while (pages < MAX_PAGES) {
      const resp = await shopifyClient.graphql(CUSTOMER_ORDERS_QUERY, {
        query: searchQuery,
        cursor,
      });

      // Prototype/mock client (or a misconfigured production client) returns no
      // order data. FR-9: an empty picker is a VALID state, not an error — but
      // we must NOT silently substitute the catalog. Warn loudly and return [].
      const ordersConn = resp?.data?.orders;
      if (!ordersConn) {
        if (resp?._mock) {
          logger.warn(
            MODULE,
            `Shopify order-history seeding unavailable (mock/prototype client) for customer ${numericCustomerId} — ` +
              `starting onboarding picker empty. No suggestions will be fabricated from the catalog (FR-9).`
          );
        } else {
          logger.warn(
            MODULE,
            `Shopify orders query returned no data for customer ${numericCustomerId} — starting picker empty (FR-9).`
          );
        }
        return [];
      }

      for (const edge of ordersConn.edges || []) {
        const node = edge?.node;
        if (!node) continue;
        // Double-guard on status in code (defensive, in case the search filter
        // is loosened): only paid + fulfilled orders are evidence (FR-8).
        const fin = String(node.displayFinancialStatus || "").toUpperCase();
        const ful = String(node.displayFulfillmentStatus || "").toUpperCase();
        if (fin !== "PAID" && fin !== "PARTIALLY_REFUNDED") continue;
        if (ful !== "FULFILLED" && ful !== "PARTIALLY_FULFILLED") continue;

        for (const liEdge of node.lineItems?.edges || []) {
          const sku = liEdge?.node?.variant?.sku;
          if (sku) purchasedSkus.add(String(sku));
        }
      }

      if (!ordersConn.pageInfo?.hasNextPage) break;
      cursor = ordersConn.pageInfo.endCursor;
      pages++;
    }
  } catch (e) {
    // FR-9: never let a Shopify failure fabricate suggestions. Empty is valid.
    logger.warn(MODULE, `Order-history fetch failed for customer ${numericCustomerId} (starting empty): ${e.message}`);
    return [];
  }

  if (purchasedSkus.size === 0) {
    logger.info(MODULE, `No qualifying prior orders for customer ${numericCustomerId} — picker starts empty (FR-9).`);
    return [];
  }

  // Map purchased SKUs → catalog Product records (stable identity, FR-2), then
  // filter to the current format track and dedupe by element+format.
  const products = await prisma.product.findMany({
    where: { sku: { in: Array.from(purchasedSkus) } },
    select: {
      id: true,
      sku: true,
      title: true,
      elementSymbol: true,
      elementName: true,
      atomicNumber: true,
    },
  });

  const bySku = new Map();
  for (const p of products) {
    if (p.sku) bySku.set(String(p.sku), p);
  }

  const suggestions = [];
  const seen = new Set();
  for (const sku of purchasedSkus) {
    const product = bySku.get(sku);
    if (!product || !product.elementSymbol) continue;

    const productFormat = canonicalFormatFromSku(product.sku);
    if (!matchesTrack(productFormat)) continue;

    const key = `${product.elementSymbol}:${productFormat}`;
    if (seen.has(key)) continue;
    seen.add(key);

    suggestions.push({
      elementSymbol: product.elementSymbol,
      elementName: product.elementName,
      atomicNumber: product.atomicNumber,
      format: productFormat,
      sku: product.sku,
      title: product.title,
      productId: product.id,
    });
  }

  logger.info(
    MODULE,
    `Seeded ${suggestions.length} order-history suggestion(s) for customer ${numericCustomerId} (track ${formatTrack}).`
  );
  return suggestions;
}

/**
 * Populate CollectionItem suggestions for onboarding (FR-8).
 * Marks them as SHOPIFY_ORDER_SUGGESTED source, subscriberConfirmed=false.
 */
export async function populateSuggestionsForOnboarding(
  userId,
  shopifyCustomerId,
  formatTrack,
  subscriptionContractId
) {
  const suggestions = await seedFromOrderHistory(shopifyCustomerId, formatTrack);

  // Create CollectionItem records for each suggestion
  const created = [];
  for (const item of suggestions) {
    try {
      // One row per element — don't create a duplicate suggestion if the
      // user already tracks this element in any state/format.
      const existing = await prisma.collectionItem.findFirst({
        where: {
          userId,
          elementSymbol: item.elementSymbol,
        },
      });

      if (!existing) {
        const record = await prisma.collectionItem.create({
          data: {
            userId,
            elementSymbol: item.elementSymbol,
            elementName: item.elementName || item.elementSymbol,
            atomicNumber: item.atomicNumber,
            format: item.format,
            state: "WANTED", // Start as WANTED, user will confirm/reject
            ownershipSource: OWNERSHIP_SOURCE.SHOPIFY_ORDER_SUGGESTED,
            recordedAt: new Date(),
            subscriberConfirmed: false,
            sourceSubscriptionContractId: subscriptionContractId,
            rejectedBySubscriber: false,
          },
        });
        created.push(record);
      }
    } catch (error) {
      console.error(`Failed to seed suggestion for ${item.elementSymbol}:`, error);
    }
  }

  return created;
}
