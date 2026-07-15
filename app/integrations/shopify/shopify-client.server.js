/**
 * Shopify API Client Configuration
 *
 * Provides a configured Shopify Admin API client for all integration modules.
 *
 * INTEGRATION STEPS FOR DEVELOPER:
 * 1. Install @shopify/shopify-api: `npm install @shopify/shopify-api`
 * 2. Set SHOPIFY_* env vars in .env
 * 3. Replace the mock client below with real Shopify API client
 * 4. Configure OAuth flow for app installation
 *
 * REQUIRED SHOPIFY OAUTH SCOPES:
 * - read_products, write_products
 * - read_customers, write_customers
 * - read_orders, write_orders
 * - read_inventory, write_inventory
 * - read_own_subscription_contracts, write_own_subscription_contracts
 *
 * SHOPIFY API VERSION: Pin to 2024-10 or latest stable
 */

import { SHOPIFY_CONFIG, IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger, ShopifyApiError } from "../../lib/error-handling.server.js";

const MODULE = "shopify-client";

/**
 * Shopify Admin API client.
 *
 * In prototype mode this returns a mock client that logs calls.
 * In production, replace with real @shopify/shopify-api client.
 *
 * TODO [PRODUCTION]:
 * ```js
 * import { shopifyApi, LATEST_API_VERSION } from "@shopify/shopify-api";
 * import "@shopify/shopify-api/adapters/node";
 *
 * const shopify = shopifyApi({
 *   apiKey: SHOPIFY_CONFIG.apiKey,
 *   apiSecretKey: SHOPIFY_CONFIG.apiSecret,
 *   scopes: SHOPIFY_CONFIG.scopes,
 *   hostName: process.env.APP_URL,
 *   apiVersion: SHOPIFY_CONFIG.apiVersion || LATEST_API_VERSION,
 *   isEmbeddedApp: true,
 * });
 *
 * export { shopify };
 * ```
 */

class MockShopifyClient {
  constructor() {
    this.baseUrl = `https://${SHOPIFY_CONFIG.shopDomain || "luciteria.myshopify.com"}/admin/api/${SHOPIFY_CONFIG.apiVersion}`;
    if (IS_PROTOTYPE) {
      logger.info(MODULE, "Mock Shopify client initialised (prototype mode)");
    } else {
      logger.info(MODULE, "Real Shopify client initialised (production mode)");
    }
  }

  /**
   * Simulate a GET request to Shopify Admin API.
   * @param {string} endpoint - e.g. "/products.json"
   * @param {Object} [params] - Query parameters
   * @returns {Object} Mock response
   */
  async get(endpoint, params = {}) {
    logger.debug(MODULE, `GET ${this.baseUrl}${endpoint}`, params);
    if (!IS_PROTOTYPE) {
      const url = new URL(`${this.baseUrl}${endpoint}`);
      Object.entries(params).forEach(([key, val]) => url.searchParams.append(key, val));
      const response = await fetch(url.toString(), {
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_CONFIG.accessToken,
          "Content-Type": "application/json",
        },
      });
      if (!response.ok) {
        throw new ShopifyApiError(`GET ${endpoint} failed: ${response.status}`);
      }
      return response.json();
    }
    return { data: null, _mock: true };
  }

  /**
   * Simulate a POST request to Shopify Admin API.
   * @param {string} endpoint
   * @param {Object} body
   * @returns {Object} Mock response
   */
  async post(endpoint, body = {}) {
    logger.debug(MODULE, `POST ${this.baseUrl}${endpoint}`, { bodyKeys: Object.keys(body) });
    if (!IS_PROTOTYPE) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_CONFIG.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new ShopifyApiError(`POST ${endpoint} failed: ${response.status} - ${errText}`);
      }
      return response.json();
    }
    return { data: null, _mock: true };
  }

  /**
   * Simulate a PUT request to Shopify Admin API.
   * @param {string} endpoint
   * @param {Object} body
   * @returns {Object} Mock response
   */
  async put(endpoint, body = {}) {
    logger.debug(MODULE, `PUT ${this.baseUrl}${endpoint}`, { bodyKeys: Object.keys(body) });
    if (!IS_PROTOTYPE) {
      const response = await fetch(`${this.baseUrl}${endpoint}`, {
        method: "PUT",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_CONFIG.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new ShopifyApiError(`PUT ${endpoint} failed: ${response.status} - ${errText}`);
      }
      return response.json();
    }
    return { data: null, _mock: true };
  }

  /**
   * Simulate a GraphQL request to Shopify Admin API.
   * @param {string} query - GraphQL query string
   * @param {Object} [variables]
   * @returns {Object} Mock response
   */
  async graphql(query, variables = {}) {
    const operationMatch = query.match(/(?:query|mutation)\s+(\w+)/);
    const opName = operationMatch ? operationMatch[1] : "unknown";
    logger.debug(MODULE, `GraphQL: ${opName}`, { variables });
    if (!IS_PROTOTYPE) {
      const response = await fetch(`https://${SHOPIFY_CONFIG.shopDomain}/admin/api/${SHOPIFY_CONFIG.apiVersion}/graphql.json`, {
        method: "POST",
        headers: {
          "X-Shopify-Access-Token": SHOPIFY_CONFIG.accessToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ query, variables }),
      });
      if (!response.ok) {
        const errText = await response.text();
        throw new ShopifyApiError(`GraphQL ${opName} failed: ${response.status} - ${errText}`);
      }
      return response.json();
    }
    return { data: null, _mock: true };
  }
}

/** Singleton client instance */
const shopifyClient = new MockShopifyClient();

export { shopifyClient };
export default shopifyClient;
