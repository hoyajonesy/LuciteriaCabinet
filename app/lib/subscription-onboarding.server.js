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
import { grantCarryForwardCredit } from "./credits.server.js";

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

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Write an ActivityLog entry for an onboarding lifecycle event. Best-effort:
 * logging failures must never abort the grace job. Staff attribution (if any)
 * is carried in the details JSON since ActivityLog has no separate staff FK.
 */
async function logOnboardingActivity(userId, action, details) {
  try {
    await prisma.activityLog.create({
      data: {
        userId,
        action,
        details: JSON.stringify(details || {}),
      },
    });
  } catch (e) {
    logger.warn(MODULE, `ActivityLog write failed (${action}): ${e.message}`);
  }
}

/**
 * Build a fresh magic-link onboarding URL for a subscriber. Mints a new token
 * (the previous one may have expired) bound to the same contract.
 */
async function buildOnboardingLink(userId, subscriptionContractId, formatTrack) {
  const origin = originFromRequest(null);
  try {
    const { rawToken } = await createOnboardingToken(userId, subscriptionContractId);
    if (rawToken) {
      return `${origin}/onboarding/subscription/${rawToken}?contract=${encodeURIComponent(subscriptionContractId)}`;
    }
  } catch (e) {
    logger.warn(MODULE, `Token mint failed for user ${userId}: ${e.message}`);
  }
  return `${origin}/onboarding/subscription`;
}

/**
 * Grace-window automation job (FR-22, FR-24, Section 10).
 *
 * Prototype note: this would run as a scheduled cron in production. It is an
 * admin-triggerable batch function (mirrors credits.server.js/grantAllMonthlyCredits).
 *
 * For every PENDING onboarding it:
 *  - Transitions PENDING → BACKSTOP_ONLY once the grace window has expired,
 *    sends the transparency notice (FR-24), and logs the transition.
 *  - Otherwise sends the due reminder — the final-notice (≤24h remaining) takes
 *    precedence over the midpoint reminder (≤grace/2 remaining).
 *  - Increments remindersSent idempotently so re-runs never re-send, and no
 *    reminders are ever sent once status leaves PENDING (FR-22).
 *
 * @param {Object} [opts]
 * @param {Date}   [opts.now] - Injectable clock for testing.
 * @returns {Promise<{scanned:number, reminder1:number, reminder2:number, backstop:number, errors:number}>}
 */
export async function runOnboardingGraceJob({ now = new Date() } = {}) {
  const nowMs = now.getTime();
  const halfWindowMs = (GRACE_WINDOW_DAYS * DAY_MS) / 2;

  const pending = await prisma.subscriptionOnboarding.findMany({
    where: { status: ONBOARDING_STATUS.PENDING },
    include: { user: true },
  });

  const summary = { scanned: pending.length, reminder1: 0, reminder2: 0, backstop: 0, errors: 0 };

  for (const ob of pending) {
    const user = ob.user;
    if (!user || !user.email) {
      logger.warn(MODULE, `Skipping onboarding ${ob.id}: no user/email`);
      continue;
    }

    const customerName = user.firstName || user.name || "Collector";
    const label = formatLabel(ob.formatTrack) || ob.formatTrack;
    const graceMs = ob.graceExpiresAt.getTime();

    try {
      // --- Grace expired → BACKSTOP_ONLY transition + transparency notice (FR-24). ---
      if (nowMs >= graceMs) {
        const updated = await prisma.subscriptionOnboarding.update({
          where: { id: ob.id },
          data: { status: ONBOARDING_STATUS.BACKSTOP_ONLY },
        });
        const linkUrl = await buildOnboardingLink(user.id, ob.subscriptionContractId, ob.formatTrack);
        await sendEmail({
          to: user.email,
          subject: "Your Luciteria subscription has resumed automatic selection",
          template: "subscription_onboarding_backstop",
          data: { customerName, linkUrl, formatLabel: label },
          customerId: user.id,
        });
        await logOnboardingActivity(user.id, "onboarding_backstop_fallback", {
          onboardingId: ob.id,
          contractId: ob.subscriptionContractId,
          from: ONBOARDING_STATUS.PENDING,
          to: ONBOARDING_STATUS.BACKSTOP_ONLY,
          remindersSent: updated.remindersSent,
          reason: "grace_window_expired",
        });
        logger.info(MODULE, `Contract ${ob.subscriptionContractId} → BACKSTOP_ONLY (grace expired)`);
        summary.backstop++;
        continue;
      }

      // --- Final notice: ≤24h remaining, at most once (remindersSent < 2). ---
      if (nowMs >= graceMs - DAY_MS) {
        if (ob.remindersSent < 2) {
          const linkUrl = await buildOnboardingLink(user.id, ob.subscriptionContractId, ob.formatTrack);
          await sendEmail({
            to: user.email,
            subject: "Last call: confirm the elements you own",
            template: "subscription_onboarding_final_notice",
            data: { customerName, linkUrl, formatLabel: label },
            customerId: user.id,
          });
          await prisma.subscriptionOnboarding.update({
            where: { id: ob.id },
            data: { remindersSent: 2 },
          });
          await logOnboardingActivity(user.id, "onboarding_reminder_sent", {
            onboardingId: ob.id,
            contractId: ob.subscriptionContractId,
            reminder: "final_notice",
            remindersSent: 2,
          });
          logger.info(MODULE, `Final notice sent for contract ${ob.subscriptionContractId}`);
          summary.reminder2++;
        }
        continue;
      }

      // --- Midpoint reminder: ≤grace/2 remaining, at most once (remindersSent < 1). ---
      if (nowMs >= graceMs - halfWindowMs) {
        if (ob.remindersSent < 1) {
          const linkUrl = await buildOnboardingLink(user.id, ob.subscriptionContractId, ob.formatTrack);
          const daysLeft = Math.max(0, Math.ceil((graceMs - nowMs) / DAY_MS));
          await sendEmail({
            to: user.email,
            subject: "Reminder: tell us which elements you already own",
            template: "subscription_onboarding_reminder",
            data: { customerName, linkUrl, formatLabel: label, daysLeft },
            customerId: user.id,
          });
          await prisma.subscriptionOnboarding.update({
            where: { id: ob.id },
            data: { remindersSent: 1 },
          });
          await logOnboardingActivity(user.id, "onboarding_reminder_sent", {
            onboardingId: ob.id,
            contractId: ob.subscriptionContractId,
            reminder: "midpoint",
            remindersSent: 1,
          });
          logger.info(MODULE, `Midpoint reminder sent for contract ${ob.subscriptionContractId}`);
          summary.reminder1++;
        }
        continue;
      }
    } catch (e) {
      summary.errors++;
      logger.error(MODULE, `Grace job failed for onboarding ${ob.id}: ${e.message}`);
    }
  }

  logger.info(MODULE, "Grace job complete", summary);
  return summary;
}

/**
 * Admin-triggered manual completion of an onboarding record (FR-28).
 * Sets status COMPLETE + completedAt, records staff attribution to ActivityLog.
 *
 * @param {Object} params
 * @param {string} params.onboardingId
 * @param {Object} params.staff - Admin object from requireAdmin ({ id, email, name }).
 * @returns {Promise<object>} the updated onboarding record
 */
export async function markOnboardingCompleteByAdmin({ onboardingId, staff }) {
  const onboarding = await prisma.subscriptionOnboarding.findUnique({
    where: { id: onboardingId },
  });
  if (!onboarding) {
    throw new Error(`No onboarding record ${onboardingId}`);
  }

  const from = onboarding.status;
  const updated = await prisma.subscriptionOnboarding.update({
    where: { id: onboardingId },
    data: {
      status: ONBOARDING_STATUS.COMPLETE,
      completedAt: onboarding.completedAt || new Date(),
    },
  });

  await logOnboardingActivity(onboarding.userId, "onboarding_marked_complete", {
    onboardingId,
    contractId: onboarding.subscriptionContractId,
    from,
    to: ONBOARDING_STATUS.COMPLETE,
    staffId: staff?.id || null,
    staffEmail: staff?.email || null,
    staffName: staff?.name || null,
  });

  logger.info(MODULE, `Onboarding ${onboardingId} marked COMPLETE by admin ${staff?.email || "unknown"}`);
  return updated;
}

/**
 * Handle empty eligible pool (FR-14/17/20/21).
 * Grant carry-forward credit, notify subscriber, log activity.
 * Idempotent per (subscriptionContractId, billingCycle).
 *
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.subscriptionContractId
 * @param {string} params.billingCycle - ISO date or cycle identifier (e.g., "2026-08")
 * @param {number} params.creditAmount - Subscription cycle value to carry forward
 * @param {string} params.formatTrack - Format track label for the notification
 * @param {string} [params.cabinetUrl] - URL to Cabinet for email
 * @returns {Promise<{ creditGranted: boolean, wasAlreadyGranted: boolean, transaction: object }>}
 */
export async function handleEmptyPool({
  userId,
  subscriptionContractId,
  billingCycle,
  creditAmount,
  formatTrack,
  cabinetUrl = "https://cabinet.luciteria.com",
}) {
  if (!userId || !subscriptionContractId || !billingCycle || !creditAmount) {
    throw new Error("handleEmptyPool requires userId, subscriptionContractId, billingCycle, and creditAmount");
  }

  // Grant the credit (idempotent per FR-21)
  const { balance, transaction, wasAlreadyGranted } = await grantCarryForwardCredit(
    userId,
    subscriptionContractId,
    billingCycle,
    creditAmount,
    `Empty eligible pool for ${formatTrack} — carry-forward credit for cycle ${billingCycle}`
  );

  // Log activity (only if this is the first grant to avoid duplicate logs)
  if (!wasAlreadyGranted) {
    await logOnboardingActivity(userId, "onboarding_empty_pool_credit", {
      subscriptionContractId,
      billingCycle,
      creditAmount,
      formatTrack,
      newBalance: balance,
      transactionId: transaction.id,
    });

    // Send waitlist notification email
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      try {
        await sendEmail({
          to: user.email,
          subject: `Luciteria Subscription — Waitlisted for ${formatTrack}`,
          template: "subscription_empty_pool_waitlist",
          data: {
            customerName: user.firstName || user.name || "Collector",
            formatLabel: formatTrack,
            creditAmount: creditAmount.toFixed(2),
            billingCycle,
            cabinetUrl,
          },
        });
        logger.info(MODULE, `Empty-pool waitlist email sent to ${user.email} for ${subscriptionContractId} cycle ${billingCycle}`);
      } catch (emailErr) {
        logger.error(MODULE, `Failed to send empty-pool email: ${emailErr.message}`);
      }
    }
  }

  return { creditGranted: true, wasAlreadyGranted, transaction };
}
