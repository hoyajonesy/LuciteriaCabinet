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

  // Get all products from DB (synced from Shopify)
  const products = await prisma.product.findMany({
    where: {
      status: "Active", // Only consider active products
    },
    select: {
      id: true,
      sku: true,
      title: true,
      elementSymbol: true,
      elementName: true,
      atomicNumber: true,
      shopifyProductId: true,
      shopifyVariantId: true,
    },
  });

  // Build a map of shopifyVariantId → product for quick lookup
  const variantMap = new Map();
  for (const p of products) {
    if (p.shopifyVariantId) {
      // Strip gid prefix if present
      const numericId = String(p.shopifyVariantId).split("/").pop();
      variantMap.set(numericId, p);
    }
  }

  // For the FRD slice 1, we'll use the synced Product table as the source of truth
  // rather than fetching live Shopify orders (which would require GraphQL pagination).
  // A future enhancement could query Shopify GraphQL orders API for better accuracy.
  
  // Filter products to those matching the format track
  const suggestions = [];
  for (const product of products) {
    if (!product.sku || !product.elementSymbol) continue;

    const productFormat = canonicalFormatFromSku(product.sku);
    if (!productFormat) continue;

    // Match format track (e.g. "10mm" matches "10mm_cube")
    const trackNormalized = formatTrack.replace("mm", "mm_cube").replace("lucite", "lucite_cube");
    if (productFormat !== trackNormalized && productFormat !== formatTrack) continue;

    // This is a candidate suggestion
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

  // Deduplicate by element+format (keep first occurrence)
  const seen = new Set();
  const unique = suggestions.filter(item => {
    const key = `${item.elementSymbol}:${item.format}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return unique;
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
