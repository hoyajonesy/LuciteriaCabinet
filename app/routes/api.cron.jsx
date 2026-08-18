/**
 * Protected Cron Endpoint — /api/cron
 *
 * Runs scheduled jobs: swap window close, onboarding grace expiry, credit expiry.
 * Protected by CRON_SECRET header to prevent unauthorized triggers.
 *
 * Vercel Cron (or external schedulers) POST to this endpoint hourly with:
 *   Header: X-Cron-Secret: <CRON_SECRET>
 *
 * All three jobs are idempotent, so running them hourly is safe.
 */
import { json } from "@remix-run/node";
import { runSwapWindowCloseJob } from "../lib/swap-window.server.js";
import { runOnboardingGraceJob } from "../lib/subscription-onboarding.server.js";
import { runSkipCreditExpirySweep } from "../lib/credits.server.js";
import { logger } from "../lib/error-handling.server.js";

const MODULE = "api.cron";

export async function action({ request }) {
  const cronSecret = process.env.CRON_SECRET;
  const providedSecret = request.headers.get("x-cron-secret");

  // Guard: reject if secret is missing or doesn't match
  if (!cronSecret || providedSecret !== cronSecret) {
    logger.warn(MODULE, "Unauthorized cron attempt", {
      hasEnvSecret: !!cronSecret,
      providedMatches: providedSecret === cronSecret,
    });
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = {};

  try {
    logger.info(MODULE, "Starting scheduled jobs", { timestamp: now.toISOString() });

    // Job 1: Swap window close (auto-finalize held shipments past their window)
    try {
      const swapResult = await runSwapWindowCloseJob({ now });
      results.swapWindowClose = swapResult;
      logger.info(MODULE, "Swap window close job completed", swapResult);
    } catch (err) {
      logger.error(MODULE, `Swap window close job failed: ${err.message}`, { stack: err.stack });
      results.swapWindowClose = { error: err.message };
    }

    // Job 2: Onboarding grace expiry (expire PENDING → BACKSTOP_ONLY)
    try {
      const onboardingResult = await runOnboardingGraceJob({ now });
      results.onboardingGrace = onboardingResult;
      logger.info(MODULE, "Onboarding grace job completed", onboardingResult);
    } catch (err) {
      logger.error(MODULE, `Onboarding grace job failed: ${err.message}`, { stack: err.stack });
      results.onboardingGrace = { error: err.message };
    }

    // Job 3: Credit expiry sweep (expire skip credits past their expiry date)
    try {
      const creditResult = await runSkipCreditExpirySweep({ now });
      results.creditExpiry = creditResult;
      logger.info(MODULE, "Credit expiry sweep completed", creditResult);
    } catch (err) {
      logger.error(MODULE, `Credit expiry sweep failed: ${err.message}`, { stack: err.stack });
      results.creditExpiry = { error: err.message };
    }

    return json({
      success: true,
      timestamp: now.toISOString(),
      results,
    });
  } catch (err) {
    logger.error(MODULE, `Cron run failed: ${err.message}`, { stack: err.stack });
    return json(
      {
        success: false,
        error: err.message,
        timestamp: now.toISOString(),
        results,
      },
      { status: 500 }
    );
  }
}

// Cron endpoint should only accept POST (from Vercel Cron or external scheduler)
export async function loader() {
  return json({ error: "Method not allowed. Use POST." }, { status: 405 });
}
