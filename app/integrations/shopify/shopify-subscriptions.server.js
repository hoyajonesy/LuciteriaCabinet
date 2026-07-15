/**
 * Shopify Subscriptions Integration
 *
 * Manages subscription contracts via the Shopify Subscription API.
 * Luciteria uses Shopify's native subscription contracts for recurring billing.
 *
 * SHOPIFY SUBSCRIPTION API (GraphQL):
 * - subscriptionContractCreate
 * - subscriptionContractUpdate
 * - subscriptionContractAttemptBilling
 * - subscriptionDraft operations
 *
 * IMPORTANT: Shopify's Subscription API is GraphQL-only (no REST).
 * Requires the "selling plan" app extension.
 *
 * REQUIRED SCOPES:
 * - read_own_subscription_contracts
 * - write_own_subscription_contracts
 *
 * SELLING PLAN STRUCTURE:
 * Each collection type has a selling plan group with monthly/quarterly/annual options.
 * Example: "Lucite Monthly", "10mm Quarterly", etc.
 */

import { IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";

const MODULE = "shopify-subscriptions";

/**
 * Fetch a customer's active subscription contract.
 *
 * TODO [PRODUCTION]:
 * ```graphql
 * query GetSubscriptionContract($id: ID!) {
 *   subscriptionContract(id: $id) {
 *     id
 *     status
 *     nextBillingDate
 *     billingPolicy { interval intervalCount }
 *     deliveryPolicy { interval intervalCount }
 *     lines(first: 5) {
 *       edges { node { id variantId quantity currentPrice { amount } } }
 *     }
 *     customer { id email firstName lastName }
 *   }
 * }
 * ```
 *
 * @param {string} contractId - Shopify Subscription Contract GID
 * @returns {Promise<Object|null>}
 */
export async function fetchSubscriptionContract(contractId) {
  logger.debug(MODULE, `fetchSubscriptionContract: ${contractId}`);

  if (IS_PROTOTYPE) {
    return null; // Prototype uses mock-db subscriptions
  }

  // TODO [PRODUCTION]: GraphQL query
  return null;
}

/**
 * Create a new subscription contract for a customer.
 *
 * Called when:
 * - Customer completes onboarding and selects a plan
 * - Admin creates a subscription on behalf of a customer
 *
 * TODO [PRODUCTION]:
 * ```graphql
 * mutation CreateSubscriptionDraft($input: SubscriptionDraftInput!) {
 *   subscriptionDraftCreate(input: $input) {
 *     draft { id }
 *     userErrors { field message }
 *   }
 * }
 * ```
 * Then commit the draft:
 * ```graphql
 * mutation CommitDraft($draftId: ID!) {
 *   subscriptionDraftCommit(draftId: $draftId) {
 *     contract { id status }
 *     userErrors { field message }
 *   }
 * }
 * ```
 *
 * @param {Object} params
 * @param {string} params.shopifyCustomerId
 * @param {string} params.collectionType
 * @param {string} params.billingCadence - "monthly" | "quarterly" | "annual"
 * @param {number} params.priceUsd
 * @returns {Promise<Object>} Created contract
 */
export async function createSubscription({
  shopifyCustomerId,
  collectionType,
  billingCadence,
  priceUsd,
}) {
  logger.info(MODULE, "createSubscription", { shopifyCustomerId, collectionType, billingCadence, priceUsd });

  if (IS_PROTOTYPE) {
    return {
      id: `mock_contract_${Date.now()}`,
      status: "active",
      _mock: true,
    };
  }

  // TODO [PRODUCTION]: Create subscription draft → commit
  return null;
}

/**
 * Pause a customer's subscription.
 *
 * TODO [PRODUCTION]:
 * - Use subscriptionContractUpdate to set status: PAUSED
 * - Record pause date for grandfathering calculation
 * - Send pause confirmation notification
 *
 * @param {string} contractId
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function pauseSubscription(contractId, reason = "") {
  logger.info(MODULE, `pauseSubscription: ${contractId}`, { reason });

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]: GraphQL mutation
  return true;
}

/**
 * Resume a paused subscription.
 *
 * TODO [PRODUCTION]:
 * - Use subscriptionContractUpdate to set status: ACTIVE
 * - Calculate new next billing date
 * - Update grandfathering pause bank
 *
 * @param {string} contractId
 * @returns {Promise<boolean>}
 */
export async function resumeSubscription(contractId) {
  logger.info(MODULE, `resumeSubscription: ${contractId}`);

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]: GraphQL mutation
  return true;
}

/**
 * Cancel a subscription.
 *
 * TODO [PRODUCTION]:
 * - Use subscriptionContractUpdate to set status: CANCELLED
 * - Handle prorated refund if applicable
 * - Remove customer from assignment queue
 *
 * @param {string} contractId
 * @param {string} reason
 * @returns {Promise<boolean>}
 */
export async function cancelSubscription(contractId, reason = "") {
  logger.info(MODULE, `cancelSubscription: ${contractId}`, { reason });

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]: GraphQL mutation
  return true;
}

/**
 * Update the subscription line item (swap assigned product for next shipment).
 *
 * Called by the assignment engine when it picks the next element to send.
 *
 * TODO [PRODUCTION]:
 * ```graphql
 * mutation UpdateSubscriptionDraft($draftId: ID!, $input: SubscriptionDraftInput!) {
 *   subscriptionDraftUpdate(draftId: $draftId, input: $input) {
 *     draft { id }
 *     userErrors { field message }
 *   }
 * }
 * ```
 *
 * @param {string} contractId
 * @param {string} newVariantId - Shopify variant GID of the new product
 * @param {number} price - Price to charge
 * @returns {Promise<boolean>}
 */
export async function updateSubscriptionLineItem(contractId, newVariantId, price) {
  logger.info(MODULE, "updateSubscriptionLineItem", { contractId, newVariantId, price });

  if (IS_PROTOTYPE) {
    return true;
  }

  // TODO [PRODUCTION]: Create draft, update line, commit
  return true;
}
