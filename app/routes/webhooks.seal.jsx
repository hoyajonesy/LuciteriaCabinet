import { json } from "@remix-run/node";
import {
  validateSealWebhook,
  parseSealPayload,
  generateIdempotencyKey,
} from "../integrations/seal/seal-payload.server.js";
import { routeSealEvent } from "../integrations/seal/seal-webhooks.server.js";
import { processWebhookIdempotently } from "../lib/idempotency.server.js";
import { SEAL_CONFIG } from "../config/environment.server.js";
import { logger } from "../lib/error-handling.server.js";

const MODULE = "webhooks.seal";

/**
 * Seal Subscriptions webhook endpoint.
 *
 * Configure this URL as the webhook callback in the Seal Subscriptions app
 * (Settings → General settings → API / Webhooks):
 *   https://<cabinet-host>/webhooks/seal
 *
 * Flow:
 *   1. Read the raw request body (needed verbatim for HMAC verification).
 *   2. Verify the HMAC-SHA256 signature (base64, secret = SEAL_API_SECRET;
 *      bypassed in prototype mode).
 *   3. Parse + normalize the payload into a canonical shape.
 *   4. Generate a deterministic idempotency key.
 *   5. Route the event through the idempotency wrapper, which logs to
 *      the webhook log table and prevents duplicate processing.
 *
 * Response policy (mirrors the existing Shopify webhook routes):
 *   - 401 when the signature is invalid (Seal should not retry a bad secret).
 *   - 200 on success AND on handler failure, so Seal does not enter an
 *     infinite retry loop over a transient/internal error. Failures are
 *     recorded in the webhook log for later inspection / manual replay.
 */
export const action = async ({ request }) => {
  // Only POST is a valid webhook delivery.
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  let rawBody = "";
  try {
    rawBody = await request.text();
    const signatureHeader = request.headers.get(SEAL_CONFIG.signatureHeader);

    // 1. Verify signature.
    if (!validateSealWebhook(rawBody, signatureHeader)) {
      logger.warn(MODULE, "Seal webhook signature validation failed");
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
    //    Seal delivers the topic in the X-Seal-Topic header.
    const topicHeader =
      request.headers.get(SEAL_CONFIG.topicHeader) ||
      request.headers.get("x-seal-topic") ||
      request.headers.get("x-seal-event") ||
      "";
    const payload = parseSealPayload(raw, topicHeader);
    const eventType = payload.event;

    logger.info(MODULE, "Received Seal webhook", {
      eventType,
      contractId: payload.subscriptionContractId,
      customerEmail: payload.customerEmail,
    });

    // 4. Idempotency key — same delivery twice → same key → deduped.
    const idempotencyKey = generateIdempotencyKey(eventType, payload);

    // 5. Process through the idempotency wrapper (logs the webhook).
    const outcome = await processWebhookIdempotently({
      eventType,
      idempotencyKey,
      payload,
      rawBody,
      handler: async (normalizedPayload) =>
        routeSealEvent(eventType, normalizedPayload),
    });

    if (outcome.duplicate) {
      return json({ ok: true, duplicate: true, logId: outcome.logId });
    }

    return json({ ok: true, logId: outcome.logId, result: outcome.result });
  } catch (error) {
    logger.error(MODULE, `Seal webhook route error: ${error.message}`, {
      stack: error.stack,
    });
    // Acknowledge with 200 so Seal does not retry indefinitely; the failure
    // is already captured in the webhook log for manual replay.
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
