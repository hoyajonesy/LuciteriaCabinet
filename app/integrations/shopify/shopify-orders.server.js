/**
 * Shopify Orders Integration
 *
 * Handles order creation for subscription shipments, tracking, and fulfillment.
 *
 * WORKFLOW:
 * 1. Assignment engine picks a product → creates a draft order
 * 2. Subscription billing succeeds → order is confirmed
 * 3. Warehouse fulfills → tracking number is added
 * 4. Customer receives → collection record is updated
 *
 * SHOPIFY API ENDPOINTS:
 * - POST /admin/api/2024-10/draft_orders.json
 * - PUT  /admin/api/2024-10/draft_orders/{id}/complete.json
 * - POST /admin/api/2024-10/orders/{id}/fulfillments.json
 * - GET  /admin/api/2024-10/orders.json?customer_id=...
 *
 * REQUIRED SCOPES: read_orders, write_orders, read_draft_orders, write_draft_orders
 */

import { IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";

const MODULE = "shopify-orders";

/**
 * Create a draft order for a subscription shipment.
 *
 * TODO [PRODUCTION]:
 * - POST /admin/api/2024-10/draft_orders.json
 *   { draft_order: { customer: { id }, line_items: [{ variant_id, quantity: 1, price }], tags: "subscription,luciteria-cabinet" } }
 * - Store the draft_order.id in SubscriptionShipment.shopifyOrderId
 *
 * @param {Object} params
 * @param {string} params.shopifyCustomerId
 * @param {string} params.shopifyVariantId
 * @param {number} params.price
 * @param {string} params.note - Internal note about assignment
 * @returns {Promise<Object>} Draft order details
 */
export async function createDraftOrder({ shopifyCustomerId, shopifyVariantId, price, note = "" }) {
  logger.info(MODULE, "createDraftOrder", { shopifyCustomerId, shopifyVariantId, price });

  if (IS_PROTOTYPE) {
    return {
      id: `mock_draft_${Date.now()}`,
      orderNumber: Math.floor(Math.random() * 10000),
      status: "open",
      _mock: true,
    };
  }

  // TODO [PRODUCTION]: Shopify draft order API
  return null;
}

/**
 * Complete (finalize) a draft order after subscription billing succeeds.
 *
 * TODO [PRODUCTION]:
 * - PUT /admin/api/2024-10/draft_orders/{id}/complete.json
 *   { payment_pending: false }
 *
 * @param {string} draftOrderId
 * @returns {Promise<Object>} Completed order
 */
export async function completeDraftOrder(draftOrderId) {
  logger.info(MODULE, `completeDraftOrder: ${draftOrderId}`);

  if (IS_PROTOTYPE) {
    return { id: draftOrderId, status: "paid", _mock: true };
  }

  // TODO [PRODUCTION]
  return null;
}

/**
 * Add fulfillment (tracking number) to an order.
 *
 * TODO [PRODUCTION]:
 * - POST /admin/api/2024-10/orders/{id}/fulfillments.json
 *   { fulfillment: { tracking_number, tracking_url, tracking_company, line_items: [...] } }
 *
 * @param {string} shopifyOrderId
 * @param {Object} tracking
 * @param {string} tracking.number
 * @param {string} tracking.url
 * @param {string} tracking.company - e.g. "FedEx", "UPS"
 * @returns {Promise<boolean>}
 */
export async function addFulfillment(shopifyOrderId, tracking) {
  logger.info(MODULE, "addFulfillment", { shopifyOrderId, tracking });

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]
  return true;
}

/**
 * Fetch order history for a customer.
 *
 * TODO [PRODUCTION]:
 * - GET /admin/api/2024-10/orders.json?customer_id={id}&status=any&tag=subscription
 *
 * @param {string} shopifyCustomerId
 * @returns {Promise<Array>}
 */
export async function fetchCustomerOrders(shopifyCustomerId) {
  logger.debug(MODULE, `fetchCustomerOrders: ${shopifyCustomerId}`);

  if (IS_PROTOTYPE) {
    return []; // Prototype uses mock shipment data
  }

  // TODO [PRODUCTION]
  return [];
}
