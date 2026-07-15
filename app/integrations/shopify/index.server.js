/**
 * Shopify Integration — Barrel Export
 *
 * Import all Shopify integration modules from a single entry point:
 *   import { fetchProducts, createSubscription, ... } from "../integrations/shopify/index.server";
 */

export { shopifyClient } from "./shopify-client.server.js";
export { fetchProducts, fetchProductBySku, fetchInventoryLevels, decrementInventory } from "./shopify-products.server.js";
export { fetchCustomer, fetchSubscribedCustomers, updateCustomerMetafield } from "./shopify-customers.server.js";
export { fetchSubscriptionContract, createSubscription, pauseSubscription, resumeSubscription, cancelSubscription, updateSubscriptionLineItem } from "./shopify-subscriptions.server.js";
export { createDraftOrder, completeDraftOrder, addFulfillment, fetchCustomerOrders } from "./shopify-orders.server.js";
export { getMetafields, setMetafields, createMetafieldDefinitions } from "./shopify-metafields.server.js";
export { validateWebhookHmac, handleWebhook, registerWebhooks } from "./shopify-webhooks.server.js";
