/**
 * Shopify Customers Integration
 *
 * Handles syncing customer data between Shopify and the Collector Cabinet.
 * In prototype mode, returns mock customer data.
 * In production, calls Shopify Admin API + metafields for collection data.
 *
 * SHOPIFY API ENDPOINTS NEEDED:
 * - GET  /admin/api/2024-10/customers.json
 * - GET  /admin/api/2024-10/customers/{id}.json
 * - GET  /admin/api/2024-10/customers/{id}/metafields.json
 * - POST /admin/api/2024-10/customers/{id}/metafields.json
 * - PUT  /admin/api/2024-10/metafields/{id}.json
 *
 * METAFIELD STRUCTURE (namespace: "luciteria_collection"):
 *   - collection_type:    "lucite" | "10mm" | "25.4mm" | "50mm" | "ampoules"
 *   - owned_elements:     JSON array of element symbols ["Sr", "Na", ...]
 *   - wishlist:           JSON array of SKUs
 *   - preferences:        JSON object of assignment preferences
 *   - onboarded_at:       ISO date string
 *   - display_name:       "The Completionist" etc.
 *
 * REQUIRED SCOPES: read_customers, write_customers
 */

import { IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { SHOPIFY_METAFIELD_NAMESPACES } from "../../config/constants.server.js";
import { shopifyClient } from "./shopify-client.server.js";

const MODULE = "shopify-customers";

/**
 * Create a new customer in Shopify.
 *
 * @param {Object} params
 * @param {string} params.email
 * @param {string} params.firstName
 * @param {string} params.lastName
 * @returns {Promise<Object>} Created Shopify Customer object
 */
export async function createShopifyCustomer({ email, firstName, lastName }) {
  logger.info(MODULE, `createShopifyCustomer: ${email}`);

  if (IS_PROTOTYPE) {
    // Generate a realistic mock response for customer creation in prototype mode
    const mockId = Math.floor(1000000000 + Math.random() * 9000000000); // 10-digit numeric ID
    logger.debug(MODULE, `createShopifyCustomer (prototype): Generated mock ID ${mockId}`);
    return {
      id: mockId,
      email: email.toLowerCase().trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    };
  }

  const body = {
    customer: {
      email: email.toLowerCase().trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      verified_email: true,
    },
  };

  try {
    const response = await shopifyClient.post("/customers.json", body);
    if (!response || !response.customer) {
      throw new Error("Invalid response received from Shopify API");
    }
    return response.customer;
  } catch (error) {
    logger.error(MODULE, `Failed to create customer in Shopify: ${error.message}`, error);
    throw error;
  }
}

/**
 * Fetch a customer from Shopify by their Shopify Customer ID.
 *
 * TODO [PRODUCTION]:
 * - GET /admin/api/2024-10/customers/{shopifyCustomerId}.json
 * - Also fetch metafields for collection data
 * - Map to local Customer shape
 *
 * @param {string} shopifyCustomerId
 * @returns {Promise<Object|null>}
 */
export async function fetchCustomer(shopifyCustomerId) {
  if (IS_PROTOTYPE) {
    logger.debug(MODULE, `fetchCustomer (prototype): ${shopifyCustomerId}`);
    return null; // Prototype uses mock-db
  }

  // TODO [PRODUCTION]:
  // const response = await shopifyClient.get(`/customers/${shopifyCustomerId}.json`);
  // const metafields = await fetchCustomerMetafields(shopifyCustomerId);
  // return shopifyCustomerToLocal(response.customer, metafields);
  return null;
}

/**
 * Fetch all customers with active subscriptions.
 *
 * TODO [PRODUCTION]:
 * - Use customer search API or tags to find subscribers
 * - GET /admin/api/2024-10/customers/search.json?query=tag:luciteria-subscriber
 *
 * @returns {Promise<Array>}
 */
export async function fetchSubscribedCustomers() {
  if (IS_PROTOTYPE) {
    return []; // Prototype uses mock-db
  }

  // TODO [PRODUCTION]:
  // const response = await shopifyClient.get("/customers/search.json", {
  //   query: "tag:luciteria-subscriber",
  //   limit: 250,
  // });
  // return response.customers.map(c => shopifyCustomerToLocal(c));
  return [];
}

/**
 * Fetch customer metafields (collection data stored in Shopify).
 *
 * TODO [PRODUCTION]:
 * - GET /admin/api/2024-10/customers/{id}/metafields.json?namespace=luciteria_collection
 *
 * @param {string} shopifyCustomerId
 * @returns {Promise<Object>} Parsed metafield values
 */
export async function fetchCustomerMetafields(shopifyCustomerId) {
  if (IS_PROTOTYPE) {
    return {};
  }

  // TODO [PRODUCTION]:
  // const response = await shopifyClient.get(
  //   `/customers/${shopifyCustomerId}/metafields.json`,
  //   { namespace: SHOPIFY_METAFIELD_NAMESPACES.collection }
  // );
  // return parseMetafields(response.metafields);
  return {};
}

/**
 * Update a customer's collection metafield in Shopify.
 *
 * Use this when:
 * - Customer selects a collection type during onboarding
 * - Admin changes a customer's collection type
 * - An element is added to the customer's collection
 *
 * TODO [PRODUCTION]:
 * - POST /admin/api/2024-10/customers/{id}/metafields.json
 *   or use GraphQL metafieldsSet mutation for batch updates
 *
 * @param {string} shopifyCustomerId
 * @param {string} key - Metafield key (e.g. "collection_type", "owned_elements")
 * @param {*} value - Value to set (will be JSON-stringified if object/array)
 * @returns {Promise<boolean>}
 */
export async function updateCustomerMetafield(shopifyCustomerId, key, value) {
  logger.info(MODULE, `updateCustomerMetafield: ${shopifyCustomerId} → ${key}`, value);

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]:
  // const body = {
  //   metafield: {
  //     namespace: SHOPIFY_METAFIELD_NAMESPACES.collection,
  //     key,
  //     value: typeof value === "string" ? value : JSON.stringify(value),
  //     type: typeof value === "string" ? "single_line_text_field" : "json",
  //   },
  // };
  // await shopifyClient.post(`/customers/${shopifyCustomerId}/metafields.json`, body);
  return true;
}

/**
 * Map Shopify customer + metafields to local Customer shape.
 *
 * @param {Object} shopifyCustomer
 * @param {Object} metafields
 * @returns {Object} Local customer shape
 */
export function shopifyCustomerToLocal(shopifyCustomer, metafields = {}) {
  // TODO [PRODUCTION]: Implement full mapping
  // return {
  //   id: `shopify_${shopifyCustomer.id}`,
  //   shopifyId: String(shopifyCustomer.id),
  //   email: shopifyCustomer.email,
  //   firstName: shopifyCustomer.first_name,
  //   lastName: shopifyCustomer.last_name,
  //   displayName: metafields.display_name || "",
  //   collectionType: metafields.collection_type || "lucite",
  //   onboardedAt: metafields.onboarded_at || null,
  //   ownedElements: JSON.parse(metafields.owned_elements || "[]"),
  //   wishlist: JSON.parse(metafields.wishlist || "[]"),
  //   preferences: JSON.parse(metafields.preferences || "{}"),
  // };
  return shopifyCustomer;
}
