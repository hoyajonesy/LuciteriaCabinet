/**
 * Luciteria Collector Cabinet — Appstle Webhook Type Definitions (JSDoc)
 *
 * Appstle does not ship official TypeScript types, and payload shapes vary
 * slightly between event types and Appstle versions. These JSDoc typedefs
 * document the *normalized* shape the Cabinet works with after
 * `parseAppstlePayload()` runs.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §4.3 for raw payload examples.
 */

/**
 * Canonical Appstle event types the Cabinet handles.
 * @readonly
 * @enum {string}
 */
export const APPSTLE_EVENTS = {
  SUBSCRIPTION_CREATED: "subscription/created",
  SUBSCRIPTION_UPDATED: "subscription/updated",
  SUBSCRIPTION_CANCELLED: "subscription/cancelled",
  SUBSCRIPTION_PAUSED: "subscription/paused",
  SUBSCRIPTION_ACTIVATED: "subscription/activated",
  SUBSCRIPTION_PLAN_CHANGED: "subscription/plan_changed",
  SUBSCRIPTION_ORDER_SKIPPED: "subscription/order_skipped",
  SUBSCRIPTION_CONTRACT_RENEWED: "subscription/contract_renewed",
  SUBSCRIPTION_PRODUCT_SWAPPED: "subscription/product_swapped",
  BILLING_ATTEMPT_SUCCEEDED: "billing_attempt/succeeded",
  BILLING_ATTEMPT_FAILED: "billing_attempt/failed",
};

/**
 * Appstle subscription status strings (as sent in payloads) normalized to
 * the Cabinet's lowercase Subscription.status values.
 * @readonly
 * @enum {string}
 */
export const APPSTLE_STATUS_MAP = {
  ACTIVE: "active",
  ACTIVATED: "active",
  PAUSED: "paused",
  CANCELLED: "cancelled",
  CANCELED: "cancelled",
  EXPIRED: "cancelled",
  PAST_DUE: "past_due",
  FAILED: "past_due",
};

/**
 * @typedef {Object} AppstleLineItem
 * @property {string} variantId   - Shopify variant GID or numeric id
 * @property {number} quantity
 * @property {number} price
 * @property {string} [sku]
 * @property {string} [title]
 */

/**
 * Normalized Appstle webhook payload used across all handlers.
 *
 * @typedef {Object} NormalizedAppstlePayload
 * @property {string}  event                 - Canonical event type (see APPSTLE_EVENTS)
 * @property {string}  [subscriptionContractId] - Appstle contract id
 * @property {string}  [shopifyContractId]   - Shopify SubscriptionContract GID
 * @property {string}  [customerEmail]       - Lowercased, trimmed customer email
 * @property {string}  [customerFirstName]
 * @property {string}  [customerLastName]
 * @property {string}  [shopifyCustomerId]   - Numeric Shopify customer id
 * @property {string}  [appstleCustomerId]   - Appstle customer id
 * @property {string}  [status]              - Normalized Cabinet status
 * @property {string}  [rawStatus]           - Original Appstle status string
 * @property {string}  [sellingPlanId]
 * @property {string}  [sellingPlanName]
 * @property {string}  [sellingPlanGroupName]
 * @property {string}  [billingInterval]     - "MONTH" | "WEEK" | ...
 * @property {number}  [billingIntervalCount]
 * @property {number}  [price]               - Recurring price
 * @property {number}  [amountCharged]       - Amount of this billing attempt
 * @property {string}  [currency]
 * @property {string}  [billingAttemptId]
 * @property {string}  [orderId]             - Shopify order GID (billing/order)
 * @property {string}  [orderNumber]
 * @property {Date}    [billingDate]
 * @property {Date}    [nextBillingDate]
 * @property {Date}    [createdAt]
 * @property {Date}    [updatedAt]
 * @property {AppstleLineItem[]} [lineItems]
 * @property {Object}  [metadata]            - Selling plan metadata { collection_type, tier_key }
 * @property {Object}  raw                   - The original, untouched payload
 */

/**
 * @typedef {Object} ResolvedCustomer
 * @property {Object} user     - Cabinet User record
 * @property {Object} customer - Cabinet Customer record
 * @property {boolean} createdUser
 * @property {boolean} createdCustomer
 */
