import { json } from "@remix-run/node";
import {
  validateAppstleWebhook,
  parseAppstlePayload,
  generateIdempotencyKey,
} from "../integrations/appstle/appstle-payload.server.js";
import { routeAppstleEvent } from "../integrations/appstle/appstle-webhooks.server.js";
import { processWebhookIdempotently } from "../lib/idempotency.server.js";
import { APPSTLE_CONFIG } from "../config/environment.server.js";
import { logger } from "../lib/error-handling.server.js";

const MODULE = "webhooks.appstle";

/**
 * Appstle Subscriptions webhook endpoint.
 *
 * Flow:
 *   1. Read the raw request body (needed verbatim for HMAC verification).
 *   2. Verify the HMAC-SHA256 signature (bypassed in prototype mode).
 *   3. Parse + normalize the payload into a canonical shape.
 *   4. Generate a deterministic idempotency key.
 *   5. Route the event through the idempotency wrapper, which logs to
 *      AppstleWebhookLog and prevents duplicate processing.
 *
 * Response policy (mirrors the existing Shopify webhook routes):
 *   - 401 when the signature is invalid (Appstle should not retry a bad secret).
 *   - 200 on success AND on handler failure, so Appstle does not enter an
 *     infinite retry loop over a transient/internal error. Failures are
 *     recorded in AppstleWebhookLog for later inspection / manual replay.
 */
export const action = async ({ request }) => {
  // Only POST is a valid webhook delivery.
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
    const signatureHeader = request.headers.get(APPSTLE_CONFIG.signatureHeader);

    // 1. Verify signature.
    if (!validateAppstleWebhook(rawBody, signatureHeader)) {
      logger.warn(MODULE, "Appstle webhook signature validation failed");
      return json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Parse the JSON body.
    let raw;
    try {
      raw = JSON.parse(rawBody);
    } catch (parseErr) {
      logger.error(MODULE, `Invalid JSON body: ${parseErr.message}`);
      // Bad JSON is not retryable — acknowledge to stop retries.
      return json({ error: "Invalid JSON payload" }, { status: 200 });
    }

    // 3. Normalize the payload and resolve the canonical event type.
    const topicHeader =
      request.headers.get("x-appstle-topic") ||
      request.headers.get("x-appstle-event") ||
      "";
    const payload = parseAppstlePayload(raw, topicHeader);
    const eventType = payload.event;

    logger.info(MODULE, "Received Appstle webhook", {
      eventType,
      contractId: payload.subscriptionContractId,
      customerEmail: payload.customerEmail,
    });

    // 4. Idempotency key — same delivery twice → same key → deduped.
    const idempotencyKey = generateIdempotencyKey(eventType, payload);

    // 5. Process through the idempotency wrapper (logs to AppstleWebhookLog).
    const outcome = await processWebhookIdempotently({
      eventType,
      idempotencyKey,
      payload,
      rawBody,
      handler: async (normalizedPayload) =>
        routeAppstleEvent(eventType, normalizedPayload),
    });

    if (outcome.duplicate) {
      return json({ ok: true, duplicate: true, logId: outcome.logId });
    }

    return json({ ok: true, logId: outcome.logId, result: outcome.result });
  } catch (error) {
    logger.error(MODULE, `Appstle webhook route error: ${error.message}`, {
      stack: error.stack,
    });
    // Acknowledge with 200 so Appstle does not retry indefinitely; the failure
    // is already captured in AppstleWebhookLog for manual replay.
    return json(
      { error: "Webhook handler failed", details: error.message },
      { status: 200 }
    );
  }
};

/**
 * Reject GET (and other non-POST) requests with 405.
 */
export const loader = async () => {
  return json({ error: "Method not allowed" }, { status: 405 });
};
