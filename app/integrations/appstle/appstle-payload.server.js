/**
 * Luciteria Collector Cabinet — Appstle Payload Parsing & Verification
 *
 * Responsibilities:
 *  - Validate the HMAC-SHA256 signature on inbound Appstle webhooks
 *  - Normalize the (loosely typed) Appstle payload into a stable internal shape
 *  - Derive the canonical event type + idempotency key
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §9.1 (verification) and §9.3 (idempotency).
 */

import crypto from "crypto";
import { APPSTLE_CONFIG, IS_PROTOTYPE } from "../../config/environment.server.js";
import { logger } from "../../lib/error-handling.server.js";
import { APPSTLE_EVENTS, APPSTLE_STATUS_MAP } from "./appstle-types.js";
import { mapSellingPlanToCollectionType } from "../../config/subscription-tiers.server.js";

const MODULE = "appstle-payload";

/**
 * Validate an Appstle webhook HMAC signature.
 *
 * Appstle signs the raw request body with HMAC-SHA256 using the shared
 * webhook secret configured in the Appstle dashboard. The digest encoding
 * (base64 vs hex) is configurable via APPSTLE_SIGNATURE_ENCODING.
 *
 * @param {string} rawBody - The exact raw request body string
 * @param {string} signatureHeader - Value of the Appstle signature header
 * @returns {boolean} true if valid
 */
export function validateAppstleWebhook(rawBody, signatureHeader) {
  // In prototype mode we accept everything so local testing works without a secret.
  if (IS_PROTOTYPE) {
    if (!signatureHeader) {
      logger.warn(MODULE, "Prototype mode: accepting webhook with no signature header");
    }
    return true;
  }

  const secret = APPSTLE_CONFIG.webhookSecret;
  if (!secret) {
    logger.error(MODULE, "APPSTLE_WEBHOOK_SECRET not configured — rejecting webhook");
    return false;
  }
  if (!signatureHeader) {
    logger.warn(MODULE, "Missing Appstle signature header — rejecting webhook");
    return false;
  }

  const encoding = APPSTLE_CONFIG.signatureEncoding === "hex" ? "hex" : "base64";
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
 * Determine the canonical event type from a raw Appstle payload.
 * Appstle delivers the event in different places depending on config
 * (top-level `event`, `topic`, `eventType`, or an X-Appstle-Topic header).
 *
 * @param {Object} raw - Parsed JSON payload
 * @param {string} [topicHeader] - Optional topic header value
 * @returns {string} normalized event type
 */
export function resolveEventType(raw = {}, topicHeader = "") {
  const candidate = (
    raw.event ||
    raw.eventType ||
    raw.topic ||
    raw.type ||
    topicHeader ||
    ""
  ).toString().trim();

  const normalized = candidate.toLowerCase().replace(/\./g, "/").replace(/_/g, "_");

  // Map a few known aliases to our canonical set.
  const aliases = {
    "subscription_billing_attempt/succeeded": APPSTLE_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "subscription_billing_attempt/failed": APPSTLE_EVENTS.BILLING_ATTEMPT_FAILED,
    "billing_attempt/success": APPSTLE_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "billing/succeeded": APPSTLE_EVENTS.BILLING_ATTEMPT_SUCCEEDED,
    "billing/failed": APPSTLE_EVENTS.BILLING_ATTEMPT_FAILED,
    "subscription/create": APPSTLE_EVENTS.SUBSCRIPTION_CREATED,
    "subscription/cancel": APPSTLE_EVENTS.SUBSCRIPTION_CANCELLED,
    "subscription/canceled": APPSTLE_EVENTS.SUBSCRIPTION_CANCELLED,
    "subscription/pause": APPSTLE_EVENTS.SUBSCRIPTION_PAUSED,
    "subscription/activate": APPSTLE_EVENTS.SUBSCRIPTION_ACTIVATED,
    "subscription/resumed": APPSTLE_EVENTS.SUBSCRIPTION_ACTIVATED,
    "subscription/resume": APPSTLE_EVENTS.SUBSCRIPTION_ACTIVATED,
  };

  if (aliases[normalized]) return aliases[normalized];

  // If the raw status implies a lifecycle event on a generic "updated" topic,
  // the handler layer will further refine via normalizeStatus().
  return normalized || "unknown";
}

/**
 * Normalize an Appstle status string to a Cabinet Subscription.status value.
 * @param {string} rawStatus
 * @returns {string|null}
 */
export function normalizeStatus(rawStatus) {
  if (!rawStatus) return null;
  const key = rawStatus.toString().trim().toUpperCase();
  return APPSTLE_STATUS_MAP[key] || rawStatus.toString().toLowerCase();
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
 * Normalize a raw Appstle webhook payload into {@link NormalizedAppstlePayload}.
 * Tolerant of camelCase / snake_case and nested `customer` / `subscription`
 * objects that different Appstle payload versions use.
 *
 * @param {Object} raw - Parsed JSON payload
 * @param {string} [topicHeader]
 * @returns {import('./appstle-types.js').NormalizedAppstlePayload}
 */
export function parseAppstlePayload(raw = {}, topicHeader = "") {
  const event = resolveEventType(raw, topicHeader);

  // Common nested containers across Appstle payload shapes.
  const sub = raw.subscription || raw.subscriptionContract || raw.contract || {};
  const cust = raw.customer || sub.customer || {};

  const customerEmailRaw = pick({ ...raw, ...sub, ...cust }, [
    "customer_email",
    "customerEmail",
    "email",
  ]);
  const customerEmail = customerEmailRaw
    ? customerEmailRaw.toString().toLowerCase().trim()
    : undefined;

  const rawStatus = pick({ ...raw, ...sub }, ["status", "subscriptionStatus", "state"]);

  // Line items may appear as line_items / lineItems / items.
  const rawLineItems =
    raw.line_items || raw.lineItems || sub.line_items || sub.lineItems || sub.items || [];
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
    raw.metadata || sub.metadata || raw.meta || raw.properties || {};

  const parsed = {
    event,
    raw,

    subscriptionContractId: (
      pick({ ...raw, ...sub }, [
        "subscription_contract_id",
        "subscriptionContractId",
        "contract_id",
        "contractId",
        "id",
      ]) ?? undefined
    )?.toString(),

    shopifyContractId: pick({ ...raw, ...sub }, [
      "shopify_subscription_contract_id",
      "shopifySubscriptionContractId",
      "shopify_contract_id",
      "admin_graphql_api_id",
    ]),

    customerEmail,
    customerFirstName: pick({ ...raw, ...cust }, [
      "customer_first_name",
      "customerFirstName",
      "first_name",
      "firstName",
    ]),
    customerLastName: pick({ ...raw, ...cust }, [
      "customer_last_name",
      "customerLastName",
      "last_name",
      "lastName",
    ]),
    shopifyCustomerId: numericId(
      pick({ ...raw, ...cust }, ["shopify_customer_id", "shopifyCustomerId", "customer_id"])
    ),
    appstleCustomerId: (
      pick({ ...raw, ...cust }, ["appstle_customer_id", "appstleCustomerId"]) ?? undefined
    )?.toString(),

    status: normalizeStatus(rawStatus),
    rawStatus: rawStatus ? rawStatus.toString() : undefined,

    sellingPlanId: pick({ ...raw, ...sub }, [
      "selling_plan_id",
      "sellingPlanId",
    ]),
    sellingPlanName: pick({ ...raw, ...sub }, [
      "selling_plan_name",
      "sellingPlanName",
    ]),
    sellingPlanGroupName: pick({ ...raw, ...sub }, [
      "selling_plan_group_name",
      "sellingPlanGroupName",
    ]),

    billingInterval: pick({ ...raw, ...sub }, ["billing_interval", "billingInterval", "interval"]),
    billingIntervalCount:
      parseInt(
        pick({ ...raw, ...sub }, [
          "billing_interval_count",
          "billingIntervalCount",
          "intervalCount",
        ]) ?? 1,
        10
      ) || 1,

    price: toFloat(pick({ ...raw, ...sub }, ["price", "recurring_price", "amount"])),
    amountCharged: toFloat(
      pick(raw, ["amount_charged", "amountCharged", "total", "total_price"])
    ),
    currency: pick({ ...raw, ...sub }, ["currency", "currency_code"]) || "USD",

    billingAttemptId: (
      pick(raw, ["billing_attempt_id", "billingAttemptId"]) ?? undefined
    )?.toString(),
    orderId: pick(raw, ["order_id", "orderId"]),
    orderNumber: pick(raw, ["order_number", "orderName", "name"]),

    billingDate: toDate(pick(raw, ["billing_date", "billingDate"])),
    nextBillingDate: toDate(
      pick({ ...raw, ...sub }, ["next_billing_date", "nextBillingDate", "next_charge_date"])
    ),
    createdAt: toDate(pick({ ...raw, ...sub }, ["created_at", "createdAt"])),
    updatedAt: toDate(pick({ ...raw, ...sub }, ["updated_at", "updatedAt"])),

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
 * @param {import('./appstle-types.js').NormalizedAppstlePayload} payload
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
