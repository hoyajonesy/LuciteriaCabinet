/**
 * Shopify Products Integration
 *
 * Handles syncing products between Shopify and the Collector Cabinet.
 * In prototype mode, returns data from the local product catalog CSV.
 * In production, calls the Shopify Admin API.
 *
 * SHOPIFY API ENDPOINTS NEEDED:
 * - GET  /admin/api/2024-10/products.json
 * - GET  /admin/api/2024-10/products/{id}.json
 * - GET  /admin/api/2024-10/products/{id}/variants.json
 * - GET  /admin/api/2024-10/inventory_levels.json
 * - POST /admin/api/2024-10/inventory_levels/set.json
 *
 * REQUIRED SCOPES: read_products, read_inventory
 */

import { IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { shopifyClient } from "./shopify-client.server.js";
import { getCatalogProducts, getProductBySku, getSubscriptionProducts } from "../../data/product-catalog.server.js";

const MODULE = "shopify-products";

/**
 * Fetch all products from Shopify (paginated).
 *
 * TODO [PRODUCTION]:
 * - Implement cursor-based pagination (Shopify uses Link headers)
 * - Handle rate limiting (Shopify REST API: 2 requests/second)
 * - Map Shopify product fields to our Product model
 * - Store shopifyProductId and shopifyVariantId for each product
 *
 * @param {Object} [options]
 * @param {string} [options.collectionType] - Filter by collection type
 * @param {boolean} [options.subscriptionOnly] - Only subscription-eligible
 * @returns {Promise<Array>} Product objects
 */
export async function fetchProducts({ collectionType, subscriptionOnly = false } = {}) {
  if (IS_PROTOTYPE) {
    logger.debug(MODULE, "fetchProducts (prototype mode)", { collectionType, subscriptionOnly });
    return subscriptionOnly
      ? getSubscriptionProducts(collectionType)
      : getCatalogProducts(collectionType);
  }

  // TODO [PRODUCTION]: Real Shopify API call
  // const response = await shopifyClient.get("/products.json", {
  //   limit: 250,
  //   status: "active",
  //   fields: "id,title,handle,variants,tags,status,images,body_html",
  // });
  //
  // return response.products.map(shopifyProductToLocal);

  return getCatalogProducts(collectionType);
}

/**
 * Fetch a single product by SKU.
 *
 * TODO [PRODUCTION]:
 * - Use GraphQL for efficient single-product lookup by SKU:
 *   ```graphql
 *   query ProductBySku($sku: String!) {
 *     productVariants(first: 1, query: $sku) {
 *       edges { node { id sku product { id title handle tags } } }
 *     }
 *   }
 *   ```
 *
 * @param {string} sku
 * @returns {Promise<Object|null>}
 */
export async function fetchProductBySku(sku) {
  if (IS_PROTOTYPE) {
    return getProductBySku(sku);
  }

  // TODO [PRODUCTION]: GraphQL lookup
  return getProductBySku(sku);
}

/**
 * Fetch current inventory levels for a list of SKUs.
 *
 * TODO [PRODUCTION]:
 * - GET /admin/api/2024-10/inventory_levels.json?inventory_item_ids=...
 * - Map inventory_item_id back to variant/SKU
 * - Handle location-based inventory if multi-location
 *
 * @param {string[]} skus
 * @returns {Promise<Object>} Map of SKU → inventory quantity
 */
export async function fetchInventoryLevels(skus) {
  if (IS_PROTOTYPE) {
    const result = {};
    for (const sku of skus) {
      const product = getProductBySku(sku);
      result[sku] = product?.inventoryQty ?? 0;
    }
    return result;
  }

  // TODO [PRODUCTION]: Real inventory API call
  return {};
}

/**
 * Decrement inventory after a shipment is sent.
 *
 * TODO [PRODUCTION]:
 * - POST /admin/api/2024-10/inventory_levels/adjust.json
 *   { location_id, inventory_item_id, available_adjustment: -1 }
 *
 * @param {string} sku
 * @param {number} [qty=1]
 * @returns {Promise<boolean>} Success
 */
export async function decrementInventory(sku, qty = 1) {
  logger.info(MODULE, `Decrement inventory: ${sku} by ${qty}`);

  if (IS_PROTOTYPE) {
    // In prototype mode, inventory is in-memory and not persisted
    return true;
  }

  // TODO [PRODUCTION]: Real inventory adjustment
  return true;
}

/**
 * Map a Shopify product object to our local Product shape.
 * Used when syncing from Shopify API responses.
 *
 * @param {Object} shopifyProduct - Raw Shopify product
 * @returns {Object} Local product shape
 */
export function shopifyProductToLocal(shopifyProduct) {
  // TODO [PRODUCTION]: Implement full mapping
  // This is the schema mapping the developer needs to implement:
  //
  // return {
  //   id: `shopify_${shopifyProduct.id}`,
  //   shopifyProductId: String(shopifyProduct.id),
  //   shopifyVariantId: String(shopifyProduct.variants[0]?.id),
  //   sku: shopifyProduct.variants[0]?.sku || "",
  //   title: shopifyProduct.title,
  //   handle: shopifyProduct.handle,
  //   description: shopifyProduct.body_html || "",
  //   elementSymbol: extractElementFromTags(shopifyProduct.tags),
  //   elementName: extractElementNameFromTitle(shopifyProduct.title),
  //   atomicNumber: lookupAtomicNumber(elementSymbol),
  //   category: deriveCategoryFromTags(shopifyProduct.tags),
  //   format: deriveFormatFromTags(shopifyProduct.tags),
  //   collectionTypes: deriveCollectionTypes(shopifyProduct.tags),
  //   status: shopifyProduct.status === "active" ? "Active" : "Archived",
  //   inventoryQty: shopifyProduct.variants[0]?.inventory_quantity || 0,
  //   retailPrice: parseFloat(shopifyProduct.variants[0]?.price) || 0,
  //   subscriptionCost: null, // Set via metafield or admin
  //   priceUsd: parseFloat(shopifyProduct.variants[0]?.price) || 0,
  //   imageUrl: shopifyProduct.images[0]?.src || null,
  //   rarityTier: deriveRarityFromTags(shopifyProduct.tags),
  //   tags: shopifyProduct.tags.split(",").map(t => t.trim()),
  //   availableForSubscription: determineSubscriptionEligibility(shopifyProduct),
  // };

  return shopifyProduct;
}
