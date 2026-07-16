/**
 * Luciteria Collector Cabinet — Seal Subscriptions Webhook Type Definitions (JSDoc)
 *
 * Seal Subscriptions delivers webhooks with a topic in the "X-Seal-Topic"
 * header (e.g. "subscription/created", "subscription/updated") and the
 * subscription payload as JSON in the body. Payload shapes vary slightly
 * between topics, so these JSDoc typedefs document the *normalized* shape the
 * Cabinet works with after `parseSealPayload()` runs.
 *
 * Docs: https://www.sealsubscriptions.com/articles/merchant-api-documentation
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §4.3 for raw payload examples.
 */

/**
 * Canonical subscription event types the Cabinet handles.
 *
 * Seal's native topics are primarily "subscription/created" and
 * "subscription/updated" (status transitions ride on "updated" and are
 * refined by the payload status), plus billing-attempt notifications. The
 * canonical set below is the internal vocabulary every handler keys off of;
 * `resolveEventType()` maps Seal's raw topics onto these values.
 *
 * @readonly
 * @enum {string}
 */
export const SEAL_EVENTS = {
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
 * Seal subscription status strings (as sent in payloads) normalized to
 * the Cabinet's lowercase Subscription.status values. Seal commonly uses
 * ACTIVE / PAUSED / CANCELLED, plus billing states.
 * @readonly
 * @enum {string}
 */
export const SEAL_STATUS_MAP = {
  ACTIVE: "active",
  ACTIVATED: "active",
  ENABLED: "active",
  PAUSED: "paused",
  ON_HOLD: "paused",
  CANCELLED: "cancelled",
  CANCELED: "cancelled",
  EXPIRED: "cancelled",
  ENDED: "cancelled",
  PAST_DUE: "past_due",
  FAILED: "past_due",
  UNPAID: "past_due",
};

/**
 * @typedef {Object} SealLineItem
 * @property {string} variantId   - Shopify variant GID or numeric id
 * @property {number} quantity
 * @property {number} price
 * @property {string} [sku]
 * @property {string} [title]
 */

/**
 * Normalized Seal webhook payload used across all handlers.
 *
 * @typedef {Object} NormalizedSealPayload
 * @property {string}  event                 - Canonical event type (see SEAL_EVENTS)
 * @property {string}  [subscriptionContractId] - Seal subscription id
 * @property {string}  [shopifyContractId]   - Shopify SubscriptionContract GID (if present)
 * @property {string}  [customerEmail]       - Lowercased, trimmed customer email
 * @property {string}  [customerFirstName]
 * @property {string}  [customerLastName]
 * @property {string}  [shopifyCustomerId]   - Numeric Shopify customer id
 * @property {string}  [sealCustomerId]      - Seal customer id
 * @property {string}  [status]              - Normalized Cabinet status
 * @property {string}  [rawStatus]           - Original Seal status string
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
 * @property {SealLineItem[]} [lineItems]
 * @property {Object}  [metadata]            - Selling plan / rule metadata { collection_type, tier_key }
 * @property {Object}  raw                   - The original, untouched payload
 */

/**
 * @typedef {Object} ResolvedCustomer
 * @property {Object} user     - Cabinet User record
 * @property {Object} customer - Cabinet Customer record
 * @property {boolean} createdUser
 * @property {boolean} createdCustomer
 */
