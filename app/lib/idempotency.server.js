/**
 * Luciteria Collector Cabinet — Webhook Idempotency Layer
 *
 * Webhooks can be delivered multiple times (network retries, Appstle retries,
 * infrastructure hiccups). Every handler must be idempotent. This module wraps
 * a handler with dedupe + logging against the AppstleWebhookLog table.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §9.3.
 */

import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";

const MODULE = "idempotency";

/**
 * Process an Appstle webhook exactly once.
 *
 * Behaviour:
 *  - If a log row with this idempotencyKey is already "processed" → skip, return duplicate.
 *  - Otherwise upsert a "processing" log row, run the handler, then mark
 *    "processed" (success) or "failed"/"retrying" (error, based on retry count).
 *
 * @param {Object} params
 * @param {string} params.eventType
 * @param {string} params.idempotencyKey
 * @param {import('../integrations/appstle/appstle-types.js').NormalizedAppstlePayload} params.payload
 * @param {string} params.rawBody - Original raw JSON string (stored for audit)
 * @param {(payload: any, logId: string) => Promise<any>} params.handler
 * @returns {Promise<{ duplicate: boolean, logId: string|null, result: any, error?: string }>}
 */
export async function processWebhookIdempotently({
  eventType,
  idempotencyKey,
  payload,
  rawBody,
  handler,
}) {
  // 1. Fast-path duplicate check.
  if (idempotencyKey) {
    const existing = await prisma.appstleWebhookLog.findUnique({
      where: { idempotencyKey },
    });
    if (existing && existing.status === "processed") {
      logger.info(MODULE, "Duplicate webhook — already processed, skipping", {
        idempotencyKey,
        eventType,
      });
      return { duplicate: true, logId: existing.id, result: null };
    }
  }

  // 2. Upsert a log row in "processing" state.
  //    (When idempotencyKey is missing we always create a fresh row.)
  const baseData = {
    eventType,
    appstleContractId: payload.subscriptionContractId || null,
    customerEmail: payload.customerEmail || null,
    payload: rawBody || JSON.stringify(payload.raw ?? payload),
    status: "processing",
  };

  let logEntry;
  if (idempotencyKey) {
    logEntry = await prisma.appstleWebhookLog.upsert({
      where: { idempotencyKey },
      create: { ...baseData, idempotencyKey },
      update: { status: "processing", retryCount: { increment: 1 } },
    });
  } else {
    logEntry = await prisma.appstleWebhookLog.create({ data: baseData });
  }

  // 3. Run the handler; record outcome.
  try {
    const result = await handler(payload, logEntry.id);

    await prisma.appstleWebhookLog.update({
      where: { id: logEntry.id },
      data: { status: "processed", processedAt: new Date(), errorMsg: null },
    });

    return { duplicate: false, logId: logEntry.id, result };
  } catch (error) {
    const willExhaust = logEntry.retryCount >= logEntry.maxRetries;
    await prisma.appstleWebhookLog.update({
      where: { id: logEntry.id },
      data: {
        status: willExhaust ? "failed" : "retrying",
        errorMsg: error?.message?.slice(0, 1000) || "Unknown error",
      },
    });
    logger.error(MODULE, `Webhook handler failed for ${eventType}`, error);
    throw error;
  }
}

/**
 * Mark a previously-logged webhook as a duplicate (used when we detect a
 * duplicate without a formal idempotency key).
 * @param {string} logId
 */
export async function markDuplicate(logId) {
  if (!logId) return;
  await prisma.appstleWebhookLog.update({
    where: { id: logId },
    data: { status: "duplicate", processedAt: new Date() },
  });
}
