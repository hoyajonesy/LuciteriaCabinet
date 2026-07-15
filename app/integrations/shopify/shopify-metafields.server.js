/**
 * Shopify Metafields Integration
 *
 * Manages custom metafields used to store collection-specific data in Shopify.
 * Metafields are the bridge between Shopify's standard data and the Collector
 * Cabinet's custom domain model.
 *
 * METAFIELD NAMESPACE: "luciteria_collection"
 *
 * CUSTOMER METAFIELDS:
 * ┌──────────────────────┬─────────┬───────────────────────────────────────┐
 * │ Key                  │ Type    │ Description                           │
 * ├──────────────────────┼─────────┼───────────────────────────────────────┤
 * │ collection_type      │ string  │ "lucite"|"10mm"|"25.4mm"|"50mm"|"amp" │
 * │ owned_elements       │ json    │ ["Sr","Na","Ce",...] - element symbols │
 * │ wishlist_skus        │ json    │ ["Sr2x2","Na2x2",...] - SKU list      │
 * │ preferences          │ json    │ { duplicateHandling, ... }            │
 * │ display_name         │ string  │ "The Completionist"                   │
 * │ onboarded_at         │ string  │ ISO date                              │
 * │ grandfather_locked   │ string  │ ISO date when price was locked        │
 * │ grandfather_expires  │ string  │ ISO date when lock expires            │
 * └──────────────────────┴─────────┴───────────────────────────────────────┘
 *
 * PRODUCT METAFIELDS:
 * ┌──────────────────────┬─────────┬───────────────────────────────────────┐
 * │ Key                  │ Type    │ Description                           │
 * │ element_symbol       │ string  │ "Sr"                                  │
 * │ atomic_number        │ integer │ 38                                    │
 * │ subscription_cost    │ number  │ 42.00 (cost basis for margin calc)    │
 * │ subscription_eligible│ boolean │ true/false                            │
 * │ rarity_tier          │ string  │ "common"|"uncommon"|"rare"|etc        │
 * └──────────────────────┴─────────┴───────────────────────────────────────┘
 *
 * REQUIRED SCOPES: read_metafields, write_metafields
 *
 * SETUP INSTRUCTIONS:
 * 1. Create metafield definitions in Shopify Admin → Settings → Custom data
 * 2. Or use the metafieldDefinitionCreate GraphQL mutation
 * 3. Set namespace = "luciteria_collection" for all definitions
 */

import { IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { SHOPIFY_METAFIELD_NAMESPACES } from "../../config/constants.server.js";

const MODULE = "shopify-metafields";
const NS = SHOPIFY_METAFIELD_NAMESPACES.collection;

/**
 * Fetch all metafields for a resource (customer or product).
 *
 * TODO [PRODUCTION]:
 * ```graphql
 * query GetMetafields($ownerId: ID!, $namespace: String!) {
 *   node(id: $ownerId) {
 *     ... on Customer {
 *       metafields(namespace: $namespace, first: 20) {
 *         edges { node { key value type } }
 *       }
 *     }
 *   }
 * }
 * ```
 *
 * @param {string} ownerType - "customer" | "product"
 * @param {string} ownerId - Shopify GID
 * @returns {Promise<Object>} key→value map
 */
export async function getMetafields(ownerType, ownerId) {
  if (IS_PROTOTYPE) {
    return {};
  }

  // TODO [PRODUCTION]: GraphQL query
  return {};
}

/**
 * Set one or more metafields on a resource.
 *
 * TODO [PRODUCTION]:
 * ```graphql
 * mutation SetMetafields($metafields: [MetafieldsSetInput!]!) {
 *   metafieldsSet(metafields: $metafields) {
 *     metafields { key value }
 *     userErrors { field message }
 *   }
 * }
 * ```
 *
 * @param {string} ownerGid - Shopify GID (e.g. "gid://shopify/Customer/123")
 * @param {Object} fields - Key-value pairs to set
 * @returns {Promise<boolean>}
 */
export async function setMetafields(ownerGid, fields) {
  logger.info(MODULE, "setMetafields", { ownerGid, keys: Object.keys(fields) });

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]:
  // const metafields = Object.entries(fields).map(([key, value]) => ({
  //   ownerId: ownerGid,
  //   namespace: NS,
  //   key,
  //   value: typeof value === "string" ? value : JSON.stringify(value),
  //   type: typeof value === "string" ? "single_line_text_field" : "json",
  // }));
  // await shopifyClient.graphql(SET_METAFIELDS_MUTATION, { metafields });
  return true;
}

/**
 * Create all required metafield definitions in the Shopify store.
 * Run once during app installation / setup.
 *
 * TODO [PRODUCTION]:
 * Use the metafieldDefinitionCreate mutation for each definition.
 *
 * @returns {Promise<boolean>}
 */
export async function createMetafieldDefinitions() {
  logger.info(MODULE, "createMetafieldDefinitions called");

  if (IS_PROTOTYPE) {
    logger.info(MODULE, "Skipping metafield definition creation (prototype mode)");
    return true;
  }

  // TODO [PRODUCTION]: Create all definitions via GraphQL
  const definitions = [
    { name: "Collection Type", namespace: NS, key: "collection_type", ownerType: "CUSTOMER", type: "single_line_text_field" },
    { name: "Owned Elements", namespace: NS, key: "owned_elements", ownerType: "CUSTOMER", type: "json" },
    { name: "Wishlist SKUs", namespace: NS, key: "wishlist_skus", ownerType: "CUSTOMER", type: "json" },
    { name: "Preferences", namespace: NS, key: "preferences", ownerType: "CUSTOMER", type: "json" },
    { name: "Display Name", namespace: NS, key: "display_name", ownerType: "CUSTOMER", type: "single_line_text_field" },
    { name: "Element Symbol", namespace: NS, key: "element_symbol", ownerType: "PRODUCT", type: "single_line_text_field" },
    { name: "Atomic Number", namespace: NS, key: "atomic_number", ownerType: "PRODUCT", type: "number_integer" },
    { name: "Subscription Cost", namespace: NS, key: "subscription_cost", ownerType: "PRODUCT", type: "number_decimal" },
    { name: "Subscription Eligible", namespace: NS, key: "subscription_eligible", ownerType: "PRODUCT", type: "boolean" },
    { name: "Rarity Tier", namespace: NS, key: "rarity_tier", ownerType: "PRODUCT", type: "single_line_text_field" },
  ];

  logger.info(MODULE, `Would create ${definitions.length} metafield definitions`);
  return true;
}
