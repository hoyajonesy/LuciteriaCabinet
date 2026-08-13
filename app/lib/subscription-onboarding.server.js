/**
 * Subscription Onboarding — Orchestration
 *
 * Ties together the SubscriptionOnboarding lifecycle for the owned-items
 * onboarding feature. See LuciteriaCabinet_Subscription_Onboarding_FRD_v1.2.
 *
 * Responsibilities:
 *  - Create/upsert the onboarding record on subscription creation (idempotent).
 *  - Seed order-history suggestions (FR-8) + issue magic-link token (FR-12).
 *  - Send the welcome email inviting the subscriber to confirm owned items.
 *  - Resolve the assignment-engine gate (FR-15): PENDING / COMPLETE / BACKSTOP_ONLY.
 *  - Complete onboarding from the UI (FR-9/10/11): record confirmations + rejections.
 */

import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";
import { normaliseFormat, formatLabel } from "./formats.js";
import { createOnboardingToken } from "./auth.server.js";
import { populateSuggestionsForOnboarding } from "./seed-order-history.server.js";
import {
  recordOwnership,
  recordRejection,
  OWNERSHIP_SOURCE,
} from "./ownership-provenance.server.js";
import { sendEmail } from "./notifications.server.js";

const MODULE = "subscription-onboarding";

/** Default grace window: bounded fulfillment promise (FR-6). */
export const GRACE_WINDOW_DAYS = 6;

/** Onboarding status values. */
export const ONBOARDING_STATUS = {
  PENDING: "PENDING",
  COMPLETE: "COMPLETE",
  BACKSTOP_ONLY: "BACKSTOP_ONLY",
};

/**
 * Assignment gate modes returned by resolveAssignmentGate (FR-15).
 * - NORMAL: onboarding complete → full exclusion logic trusted.
 * - BACKSTOP_ONLY: grace expired without completion → assign, but only exclude
 *   confirmed-owned items and never re-trust rejected items.
 * - BLOCKED: onboarding still pending within grace → hold renewal assignments.
 */
export const GATE_MODE = {
  NORMAL: "NORMAL",
  BACKSTOP_ONLY: "BACKSTOP_ONLY",
  BLOCKED: "BLOCKED",
};

/**
 * Derive the public origin from a request (handles Vercel proxy forwarding).
 */
function originFromRequest(request) {
  if (!request) return process.env.APP_URL || "https://cabinet.luciteria.com";
  const forwardedHost = request.headers.get("x-forwarded-host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  return forwardedHost
    ? `${forwardedProto}://${forwardedHost}`
    : new URL(request.url).origin;
}

/**
 * Look up the onboarding record for a contract.
 */
export async function getOnboardingByContract(subscriptionContractId) {
  if (!subscriptionContractId) return null;
  return prisma.subscriptionOnboarding.findUnique({
    where: { subscriptionContractId: String(subscriptionContractId) },
  });
}

/**
 * Create (or return existing) onboarding record for a subscription contract,
 * seed order-history suggestions, mint a magic-link token, and send the welcome
 * email. Fully idempotent — safe to call on webhook retries (FR-16).
 *
 * @param {Object} params
 * @param {Object} params.user - User record
 * @param {Object} params.customer - Customer record (has shopifyCustomerId)
 * @param {Object} params.subscription - Subscription record (has collectionType)
 * @param {string} params.contractId - Seal/Shopify contract id
 * @param {Request} [params.request] - Optional request for origin derivation
 * @returns {Promise<{ onboarding, created: boolean }>}
 */
export async function ensureOnboardingForContract({
  user,
  customer,
  subscription,
  contractId,
  request = null,
}) {
  const subscriptionContractId = String(contractId);
  const formatTrack = subscription?.collectionType || customer?.collectionType || "lucite";

  // Idempotency: if a record already exists, return it untouched (FR-16).
  const existing = await getOnboardingByContract(subscriptionContractId);
  if (existing) {
    logger.info(MODULE, `Onboarding already exists for contract ${subscriptionContractId}`, {
      status: existing.status,
    });
    return { onboarding: existing, created: false };
  }

  const graceExpiresAt = new Date(Date.now() + GRACE_WINDOW_DAYS * 24 * 60 * 60 * 1000);

  // Create the onboarding record.
  const onboarding = await prisma.subscriptionOnboarding.create({
    data: {
      subscriptionContractId,
      userId: user.id,
      formatTrack,
      status: ONBOARDING_STATUS.PENDING,
      graceExpiresAt,
    },
  });

  // Seed suggestions from order history (FR-8). Non-fatal on failure.
  try {
    const shopifyCustomerId = customer?.shopifyCustomerId || null;
    const seeded = await populateSuggestionsForOnboarding(
      user.id,
      shopifyCustomerId,
      formatTrack,
      subscriptionContractId
    );
    if (seeded.length > 0) {
      await prisma.subscriptionOnboarding.update({
        where: { id: onboarding.id },
        data: { seededFromOrderHistory: true },
      });
    }
    logger.info(MODULE, `Seeded ${seeded.length} suggestions for ${user.email}`);
  } catch (e) {
    logger.warn(MODULE, `Seeding failed for ${user.email}: ${e.message}`);
  }

  // Mint magic-link token + send welcome email (FR-12). Non-fatal on failure.
  try {
    const { rawToken } = await createOnboardingToken(user.id, subscriptionContractId);
    if (rawToken) {
      const origin = originFromRequest(request);
      const linkUrl = `${origin}/onboarding/subscription/${rawToken}?contract=${encodeURIComponent(subscriptionContractId)}`;

      await sendEmail({
        to: user.email,
        subject: "Tell us which elements you already own",
        template: "subscription_onboarding_welcome",
        data: {
          customerName: user.firstName || user.name || "Collector",
          linkUrl,
          formatLabel: formatLabel(formatTrack) || formatTrack,
        },
        customerId: user.id,
      });
    }
  } catch (e) {
    logger.warn(MODULE, `Welcome email failed for ${user.email}: ${e.message}`);
  }

  return { onboarding, created: true };
}

/**
 * Resolve the assignment-engine gate for a user's contract (FR-15).
 * Also performs the lazy PENDING → BACKSTOP_ONLY transition once the grace
 * window has expired.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.contractId
 * @param {boolean} [params.isFirstShipment] - First shipment always proceeds (FR-13).
 * @returns {Promise<{ mode: string, onboarding: object|null }>}
 */
export async function resolveAssignmentGate({ userId, contractId, isFirstShipment = false }) {
  const onboarding = contractId ? await getOnboardingByContract(contractId) : null;

  // No onboarding record (feature off, or legacy sub) → behave normally.
  if (!onboarding) {
    return { mode: GATE_MODE.NORMAL, onboarding: null };
  }

  // First shipment is the bounded fulfillment promise — always proceeds (FR-13).
  if (isFirstShipment) {
    return { mode: GATE_MODE.NORMAL, onboarding };
  }

  if (onboarding.status === ONBOARDING_STATUS.COMPLETE) {
    return { mode: GATE_MODE.NORMAL, onboarding };
  }

  if (onboarding.status === ONBOARDING_STATUS.BACKSTOP_ONLY) {
    return { mode: GATE_MODE.BACKSTOP_ONLY, onboarding };
  }

  // PENDING: gate on the grace window.
  const graceExpired = onboarding.graceExpiresAt.getTime() < Date.now();
  if (graceExpired) {
    // Lazy transition to BACKSTOP_ONLY (FR-6/15).
    const updated = await prisma.subscriptionOnboarding.update({
      where: { id: onboarding.id },
      data: { status: ONBOARDING_STATUS.BACKSTOP_ONLY },
    });
    logger.info(MODULE, `Grace expired for contract ${contractId} → BACKSTOP_ONLY`);
    return { mode: GATE_MODE.BACKSTOP_ONLY, onboarding: updated };
  }

  // Still pending within grace → hold renewal assignment.
  return { mode: GATE_MODE.BLOCKED, onboarding };
}

/**
 * Complete the onboarding flow from the UI (FR-9/10/11).
 * Records confirmations (owned) and rejections using the provenance library,
 * then flips the onboarding record to COMPLETE.
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.contractId
 * @param {Array<{elementSymbol,format}>} params.confirmations - Items the user owns.
 * @param {Array<{elementSymbol,format}>} params.rejections - Suggestions the user declined.
 * @returns {Promise<{ onboarding: object, confirmedCount: number, rejectedCount: number }>}
 */
export async function completeOnboarding({ userId, contractId, confirmations = [], rejections = [] }) {
  const onboarding = await getOnboardingByContract(contractId);
  if (!onboarding) {
    throw new Error(`No onboarding record for contract ${contractId}`);
  }
  if (onboarding.userId !== userId) {
    throw new Error("Onboarding record does not belong to this user");
  }

  let confirmedCount = 0;
  let rejectedCount = 0;

  // Record confirmations (FR-3): explicit owned + subscriberConfirmed.
  for (const item of confirmations) {
    try {
      await recordOwnership(userId, item.elementSymbol, item.format, {
        source: OWNERSHIP_SOURCE.ONBOARDING_CONFIRMED,
        subscriberConfirmed: true,
        contractId,
        state: "OWNED",
      });
      confirmedCount++;
    } catch (e) {
      logger.warn(MODULE, `Confirm failed for ${item.elementSymbol}/${item.format}: ${e.message}`);
    }
  }

  // Record rejections (FR-4): explicit decline, never re-trusted.
  for (const item of rejections) {
    try {
      await recordRejection(userId, item.elementSymbol, item.format, contractId);
      rejectedCount++;
    } catch (e) {
      logger.warn(MODULE, `Reject failed for ${item.elementSymbol}/${item.format}: ${e.message}`);
    }
  }

  const updated = await prisma.subscriptionOnboarding.update({
    where: { id: onboarding.id },
    data: {
      status: ONBOARDING_STATUS.COMPLETE,
      completedAt: new Date(),
    },
  });

  logger.info(MODULE, `Onboarding complete for contract ${contractId}`, {
    confirmedCount,
    rejectedCount,
  });

  return { onboarding: updated, confirmedCount, rejectedCount };
}
