/**
 * Luciteria Collector Cabinet — Subscription Draft Order Creation
 *
 * Builds and submits Shopify draft orders for assigned subscription shipments.
 * Uses the shared Shopify Admin API client (mock in prototype, real fetch in
 * production). Updates the SubscriptionShipment with the resulting draft order id.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §5.2.
 */

import { shopifyClient } from "../shopify/shopify-client.server.js";
import { prisma } from "../../lib/db.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { IS_PROTOTYPE } from "../../config/environment.server.js";

const MODULE = "appstle-draft-orders";

/** Extract the numeric id from a Shopify GID or return the value as-is. */
function numericId(value) {
  if (value === undefined || value === null) return null;
  const str = value.toString();
  return str.includes("/") ? str.split("/").pop() : str;
}

/**
 * Build the Shopify draft_order request body for a subscription shipment.
 *
 * @param {Object} params
 * @param {Object} params.customer - Cabinet Customer (needs shopifyCustomerId)
 * @param {Object} params.product  - Assigned Cabinet Product
 * @param {Object} params.shipment - SubscriptionShipment record
 * @param {number} params.assignedPrice - Price the customer effectively pays
 * @param {boolean} [params.isFirstShipment]
 * @returns {Object} draft_order payload
 */
export function buildDraftOrderPayload({
  customer,
  product,
  shipment,
  assignedPrice,
  isFirstShipment = false,
}) {
  const retailPrice = product.retailPrice || product.priceUsd || 0;
  const subPrice = assignedPrice ?? shipment.assignedPrice ?? retailPrice;

  const lineItem = {
    variant_id: numericId(product.shopifyVariantId) ? parseInt(numericId(product.shopifyVariantId), 10) : undefined,
    quantity: 1,
    price: subPrice.toFixed(2),
  };

  // If there is no linked Shopify variant, fall back to a custom line item
  // so the draft order can still be created (admin resolves manually).
  if (!lineItem.variant_id) {
    delete lineItem.variant_id;
    lineItem.title = product.title || `${product.elementName} (${product.elementSymbol})`;
    lineItem.sku = product.sku;
  }

  // Represent any subscription discount as a fixed-amount applied discount.
  if (retailPrice > subPrice) {
    lineItem.applied_discount = {
      title: "Subscription Discount",
      value: (retailPrice - subPrice).toFixed(2),
      value_type: "fixed_amount",
      amount: (retailPrice - subPrice).toFixed(2),
    };
  }

  const subscriptionId = shipment.subscriptionId || null;

  const tags = ["luciteria-subscription", "cabinet-assigned"];
  if (isFirstShipment) tags.push("first-shipment");
  if (subscriptionId) tags.push(`sub-${subscriptionId}`);

  // Choose a shipping method. First shipments get the "welcome" method; both
  // are free at the point of sale because shipping is bundled into the plan.
  const shippingTitle = isFirstShipment
    ? "Luciteria Subscription — Welcome Shipment"
    : "Luciteria Subscription — Monthly Shipment";

  const draftOrder = {
    line_items: [lineItem],
    tags: tags.join(", "),
    note: isFirstShipment
      ? `First subscription shipment — Cabinet Assignment (shipment ${shipment.id})`
      : `Cabinet Assignment — Shipment ${shipment.id}`,
    // Persist the linkage back to the subscription + shipment for tracking/reconciliation.
    note_attributes: [
      { name: "cabinet_shipment_id", value: String(shipment.id) },
      { name: "cabinet_subscription_id", value: String(subscriptionId || "") },
      { name: "cabinet_shipment_type", value: isFirstShipment ? "first_shipment" : "renewal" },
    ],
    // Bundled shipping (customer already paid via the subscription plan).
    shipping_line: {
      title: shippingTitle,
      price: "0.00",
      custom: true,
    },
    use_customer_default_address: true,
  };

  const shopifyCustomerId = numericId(customer.shopifyCustomerId || customer.shopifyId);
  if (shopifyCustomerId) {
    draftOrder.customer = { id: parseInt(shopifyCustomerId, 10) };
  } else if (customer.email) {
    draftOrder.email = customer.email;
  }

  return { draft_order: draftOrder };
}

/**
 * Create a Shopify draft order for an assigned subscription shipment and
 * persist the draft order id back onto the shipment.
 *
 * @param {Object} params - Same shape as buildDraftOrderPayload params
 * @returns {Promise<{ ok: boolean, draftOrderId: string|null, mock?: boolean, raw?: any }>}
 */
export async function createSubscriptionDraftOrder(params) {
  const { customer, product, shipment } = params;
  logger.info(MODULE, "Creating subscription draft order", {
    shipmentId: shipment.id,
    customerEmail: customer.email,
    productSku: product?.sku,
  });

  const body = buildDraftOrderPayload(params);

  // Prototype mode: simulate a draft order so the flow completes end-to-end.
  if (IS_PROTOTYPE) {
    const mockId = `mock_draft_${Date.now()}`;
    await prisma.subscriptionShipment.update({
      where: { id: shipment.id },
      data: { shopifyDraftOrderId: mockId, status: "ordered" },
    });
    logger.info(MODULE, `[prototype] Simulated draft order ${mockId} for shipment ${shipment.id}`);
    return { ok: true, draftOrderId: mockId, mock: true, raw: body };
  }

  // Production: call the Shopify Admin API.
  const response = await shopifyClient.post("/draft_orders.json", body);
  const draftOrderId = response?.draft_order?.id ? String(response.draft_order.id) : null;

  if (!draftOrderId) {
    logger.error(MODULE, "Draft order creation returned no id", { shipmentId: shipment.id });
    return { ok: false, draftOrderId: null, raw: response };
  }

  await prisma.subscriptionShipment.update({
    where: { id: shipment.id },
    data: { shopifyDraftOrderId: draftOrderId, status: "ordered" },
  });

  logger.info(MODULE, `Created draft order ${draftOrderId} for shipment ${shipment.id}`);
  return { ok: true, draftOrderId, raw: response };
}
