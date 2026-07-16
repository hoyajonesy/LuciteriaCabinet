/**
 * Luciteria Collector Cabinet — Seal Subscriptions Payload Parsing & Verification
 *
 * Responsibilities:
 *  - Validate the HMAC-SHA256 signature on inbound Seal webhooks
 *  - Normalize the (loosely typed) Seal payload into a stable internal shape
 *  - Derive the canonical event type + idempotency key
 *
 * Seal signs the raw request body with HMAC-SHA256 (base64) using the shop's
 * API secret, and sends it in the "X-Seal-Hmac-Sha256" header. The topic
 * arrives in "X-Seal-Topic".
 *   base64(HMAC_SHA256(rawBody, SEAL_API_SECRET))
 *
 * Docs: https://www.sealsubscriptions.com/articles/merchant-api-documentation
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §9.1 (verification) and §9.3 (idempotency).
 */

import crypto from "crypto";
import { SEAL_CONFIG, IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { SEAL_EVENTS, SEAL_STATUS_MAP } from "./seal-types.js";
import { mapSellingPlanToCollectionType } from "../../config/subscription-tiers.server.js";

const MODULE = "seal-payload";

/**
 * Validate a Seal Subscriptions webhook HMAC signature.
 *
 * Seal signs the raw request body with HMAC-SHA256 using the shop's API
 * secret and delivers the base64 digest in the "X-Seal-Hmac-Sha256" header:
 *   base64(HMAC_SHA256(rawBody, SEAL_API_SECRET))
 *
 * @param {string} rawBody - The exact raw request body string
 * @param {string} signatureHeader - Value of the X-Seal-Hmac-Sha256 header
 * @returns {boolean} true if valid
 */
export function validateSealWebhook(rawBody, signatureHeader) {
  // In prototype mode we accept everything so local testing works without a secret.
  if (IS_PROTOTYPE) {
    if (!signatureHeader) {
      logger.warn(MODULE, "Prototype mode: accepting webhook with no signature header");
    }
    return true;
  }

  const secret = SEAL_CONFIG.apiSecret;
  if (!secret) {
    logger.error(MODULE, "SEAL_API_SECRET not configured — rejecting webhook");
    return false;
  }
  if (!signatureHeader) {
    logger.warn(MODULE, "Missing Seal signature header — rejecting webhook");
    return false;
  }

  const encoding = SEAL_CONFIG.signatureEncoding === "hex" ? "hex" : "base64";
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(rawBody, "utf8");
  const computed = hmac.digest(encoding);

  try {
    const sigBuffer = Buffer.from(signatureHeader, encoding);
    const compBuffer = Buffer.from(computed, encoding);
    if (sigBuffer.length !== compBuffer.length) return false;
    return crypto.timingSafeEqual(sigBuffer, compBuffer);
  } catch (err) {
    logger.error(MODULE, `Signature comparison failed: ${err.message}`);
    return false;
  }
}

/**
 * Determine the canonical event type from a raw Seal payload.
 * Seal delivers the topic primarily via the "X-Seal-Topic" header, but a
 * `topic`/`event` field may also appear in the body depending on config.
 *
 * @param {Object} raw - Parsed JSON payload
 * @param {string} [topicHeader] - Optional X-Seal-Topic header value
 * @returns {string} normalized event type
 */
export function resolveEventType(raw = {}, topicHeader = "") {
  const candidate = (
    topicHeader ||
    raw.topic ||
    raw.event ||
    raw.eventType ||
    raw.type ||
    ""
  ).toString().trim();

  const normalized = candidate.toLowerCase().replace(/\./g, "/").replace(/_/g, "_");

  // Map a few known aliases to our canonical set. Seal sends fewer distinct
  // topics than Appstle did (most lifecycle changes ride on
  // "subscription/updated"), so the status-based refinement in the handler
  // layer does the rest.
  const aliases = {
    "subscription/create": SEAL_EVENTS.SUBSCRIPTION_CREATED,
    "subscription/cancel": SEAL_EVENTS.SUBSCRIPTION_CANCELLED,
    "subscription/canceled": SEAL_EVENTS.SUBSCRIPTION_CANCELLED,
    "subscription/pause": SEAL_EVENTS.SUBSCRIPTION_PAUSED,
    "subscription/activate": SEAL_EVENTS.SUBSCRIPTION_ACTIVATED,
    "subscription/resumed": SEAL_EVENTS.SUBSCRIPTION_ACTIVATED,
    "subscription/resume": SEAL_EVENTS.SUBSCRIPTION_ACTIVATED,
    "subscription/reactivated": SEAL_EVENTS.SUBSCRIPTION_ACTIVATED,
    // Billing notifications (Seal + Shopify billing-attempt style names).
    "billing_attempt/success": SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "billing_attempt/succeeded": SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "billing_attempt/failure": SEAL_EVENTS.BILLING_ATTEMPT_FAILED,
    "billing_attempt/failed": SEAL_EVENTS.BILLING_ATTEMPT_FAILED,
    "billing/succeeded": SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "billing/success": SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "billing/failed": SEAL_EVENTS.BILLING_ATTEMPT_FAILED,
    "billing/failure": SEAL_EVENTS.BILLING_ATTEMPT_FAILED,
    "order/created": SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "order/create": SEAL_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
  };

  if (aliases[normalized]) return aliases[normalized];

  // If the raw status implies a lifecycle event on a generic "updated" topic,
  // the handler layer will further refine via normalizeStatus().
  return normalized || "unknown";
}

/**
 * Normalize a Seal status string to a Cabinet Subscription.status value.
 * @param {string} rawStatus
 * @returns {string|null}
 */
export function normalizeStatus(rawStatus) {
  if (!rawStatus) return null;
  const key = rawStatus.toString().trim().toUpperCase();
  return SEAL_STATUS_MAP[key] || rawStatus.toString().toLowerCase();
}

/** Safely coerce a value to a Date, or return null. */
function toDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Safely coerce a value to a float, or return null. */
function toFloat(value) {
  if (value === undefined || value === null || value === "") return null;
  const n = parseFloat(value);
  return Number.isNaN(n) ? null : n;
}

/** Strip a Shopify GID down to its numeric id ("gid://.../123" → "123"). */
function numericId(value) {
  if (value === undefined || value === null) return null;
  const str = value.toString();
  return str.includes("/") ? str.split("/").pop() : str;
}

/**
 * Pick the first defined value from a list of candidate keys on an object.
 */
function pick(obj, keys) {
  for (const k of keys) {
    if (obj[k] !== undefined && obj[k] !== null && obj[k] !== "") return obj[k];
  }
  return undefined;
}

/**
 * Normalize a raw Seal webhook payload into {@link NormalizedSealPayload}.
 * Tolerant of camelCase / snake_case and nested `customer` / `subscription`
 * containers that different Seal payload versions use. Seal wraps the
 * subscription under a top-level `payload` key on some topics, so we unwrap
 * that first.
 *
 * @param {Object} raw - Parsed JSON payload
 * @param {string} [topicHeader]
 * @returns {import('./seal-types.js').NormalizedSealPayload}
 */
export function parseSealPayload(raw = {}, topicHeader = "") {
  const event = resolveEventType(raw, topicHeader);

  // Seal often nests the subscription under `payload` (API + some webhooks).
  const root = raw.payload && typeof raw.payload === "object" ? raw.payload : raw;

  // Common nested containers across Seal payload shapes.
  const sub = root.subscription || root.subscriptionContract || root.contract || root;
  const cust = root.customer || sub.customer || {};

  const customerEmailRaw = pick({ ...root, ...sub, ...cust }, [
    "customer_email",
    "customerEmail",
    "email",
  ]);
  const customerEmail = customerEmailRaw
    ? customerEmailRaw.toString().toLowerCase().trim()
    : undefined;

  const rawStatus = pick({ ...root, ...sub }, ["status", "subscriptionStatus", "state"]);

  // Line items may appear as line_items / lineItems / items.
  const rawLineItems =
    root.line_items || root.lineItems || sub.line_items || sub.lineItems || sub.items || [];
  const lineItems = Array.isArray(rawLineItems)
    ? rawLineItems.map((li) => ({
        variantId: numericId(pick(li, ["variant_id", "variantId", "shopify_variant_id"])),
        variantGid: pick(li, ["variant_id", "variantId", "shopify_variant_id"]),
        quantity: parseInt(pick(li, ["quantity", "qty"]) ?? 1, 10) || 1,
        price: toFloat(pick(li, ["price", "amount"])),
        sku: pick(li, ["sku", "variant_sku"]),
        title: pick(li, ["title", "product_title", "name"]),
      }))
    : [];

  const metadata =
    root.metadata || sub.metadata || root.meta || root.properties || {};

  const parsed = {
    event,
    raw,

    // Seal identifies a subscription by numeric `id` (and a public `token`).
    subscriptionContractId: (
      pick({ ...root, ...sub }, [
        "subscription_id",
        "subscriptionId",
        "seal_subscription_id",
        "id",
        "token",
      ]) ?? undefined
    )?.toString(),

    shopifyContractId: pick({ ...root, ...sub }, [
      "shopify_subscription_contract_id",
      "shopifySubscriptionContractId",
      "shopify_contract_id",
      "subscription_contract_id",
      "admin_graphql_api_id",
    ]),

    customerEmail,
    customerFirstName: pick({ ...root, ...cust }, [
      "customer_first_name",
      "customerFirstName",
      "first_name",
      "firstName",
    ]),
    customerLastName: pick({ ...root, ...cust }, [
      "customer_last_name",
      "customerLastName",
      "last_name",
      "lastName",
    ]),
    shopifyCustomerId: numericId(
      pick({ ...root, ...cust }, ["shopify_customer_id", "shopifyCustomerId", "customer_id"])
    ),
    sealCustomerId: (
      pick({ ...root, ...cust }, ["seal_customer_id", "sealCustomerId"]) ?? undefined
    )?.toString(),

    status: normalizeStatus(rawStatus),
    rawStatus: rawStatus ? rawStatus.toString() : undefined,

    sellingPlanId: pick({ ...root, ...sub }, [
      "selling_plan_id",
      "sellingPlanId",
      "subscription_rule_id",
      "rule_id",
    ]),
    sellingPlanName: pick({ ...root, ...sub }, [
      "selling_plan_name",
      "sellingPlanName",
      "subscription_rule_name",
      "rule_name",
    ]),
    sellingPlanGroupName: pick({ ...root, ...sub }, [
      "selling_plan_group_name",
      "sellingPlanGroupName",
    ]),

    billingInterval: pick({ ...root, ...sub }, [
      "billing_interval",
      "billingInterval",
      "interval",
      "billing_interval_unit",
    ]),
    billingIntervalCount:
      parseInt(
        pick({ ...root, ...sub }, [
          "billing_interval_count",
          "billingIntervalCount",
          "intervalCount",
        ]) ?? 1,
        10
      ) || 1,

    price: toFloat(pick({ ...root, ...sub }, ["price", "recurring_price", "amount", "total"])),
    amountCharged: toFloat(
      pick(root, ["amount_charged", "amountCharged", "total", "total_price"])
    ),
    currency: pick({ ...root, ...sub }, ["currency", "currency_code"]) || "USD",

    billingAttemptId: (
      pick(root, ["billing_attempt_id", "billingAttemptId", "billing_id"]) ?? undefined
    )?.toString(),
    orderId: pick(root, ["order_id", "orderId", "shopify_order_id"]),
    orderNumber: pick(root, ["order_number", "orderName", "name"]),

    billingDate: toDate(pick(root, ["billing_date", "billingDate", "charged_at"])),
    nextBillingDate: toDate(
      pick({ ...root, ...sub }, ["next_billing_date", "nextBillingDate", "next_charge_date"])
    ),
    createdAt: toDate(pick({ ...root, ...sub }, ["created_at", "createdAt"])),
    updatedAt: toDate(pick({ ...root, ...sub }, ["updated_at", "updatedAt"])),

    lineItems,
    metadata,
  };

  // Derive collection type up front (used by nearly every handler).
  parsed.collectionType = mapSellingPlanToCollectionType(parsed);

  return parsed;
}

/**
 * Generate a deterministic idempotency key for a webhook event.
 * Same event delivered twice → same key → deduped.
 *
 * @param {string} eventType
 * @param {import('./seal-types.js').NormalizedSealPayload} payload
 * @returns {string}
 */
export function generateIdempotencyKey(eventType, payload) {
  const contract = payload.subscriptionContractId || "no-contract";

  // Billing events: unique per contract + billing attempt (or billing date).
  if (eventType.includes("billing_attempt") || eventType.includes("billing")) {
    const disc =
      payload.billingAttemptId ||
      (payload.billingDate ? payload.billingDate.toISOString() : "no-date");
    return `${eventType}:${contract}:${disc}`;
  }

  // Lifecycle events: unique per contract + timestamp.
  const ts =
    (payload.updatedAt && payload.updatedAt.toISOString()) ||
    (payload.createdAt && payload.createdAt.toISOString()) ||
    payload.rawStatus ||
    "no-ts";
  return `${eventType}:${contract}:${ts}`;
}
