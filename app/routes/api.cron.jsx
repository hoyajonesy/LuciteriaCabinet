/**
 * Protected Cron Endpoint — /api/cron
 *
 * Runs scheduled jobs: swap window close, onboarding grace expiry, credit expiry.
 * Protected by CRON_SECRET to prevent unauthorized triggers.
 *
 * Two trigger contracts are supported so this works regardless of scheduler:
 *
 *   1. Vercel Cron (native): sends a GET request with the secret as
 *        Authorization: Bearer <CRON_SECRET>
 *      This is what vercel.json's cron config produces.
 *
 *   2. External schedulers (cron-job.org, Upstash, the admin "Test cron"
 *      button, etc.): send a GET or POST with
 *        X-Cron-Secret: <CRON_SECRET>
 *
 * Both GET and POST are accepted, and either auth header satisfies the guard.
 * All three jobs are idempotent, so running them hourly is safe.
 */
import { json } from "@remix-run/node";
import { runSwapWindowCloseJob } from "../lib/swap-window.server.js";
import { runOnboardingGraceJob } from "../lib/subscription-onboarding.server.js";
import { runSkipCreditExpirySweep } from "../lib/credits.server.js";
import { logger } from "../lib/error-handling.server.js";

const MODULE = "api.cron";

/**
 * Validate the request against CRON_SECRET using either supported header:
 *   - Authorization: Bearer <secret>   (Vercel Cron)
 *   - X-Cron-Secret: <secret>          (external schedulers / admin test)
 * Returns true when the secret is configured and one of the headers matches.
 */
function isAuthorized(request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return { ok: false, hasEnvSecret: false };

  // Vercel Cron: Authorization: Bearer <CRON_SECRET>
  const authHeader = request.headers.get("authorization") || "";
  const bearerMatch = authHeader === `Bearer ${cronSecret}`;

  // External schedulers / admin test button: X-Cron-Secret: <CRON_SECRET>
  const customHeader = request.headers.get("x-cron-secret");
  const customMatch = customHeader === cronSecret;

  return {
    ok: bearerMatch || customMatch,
    hasEnvSecret: true,
    bearerMatch,
    customMatch,
  };
}

async function runCronJobs(request) {
  const auth = isAuthorized(request);

  // Guard: reject if secret is missing or neither header matches
  if (!auth.ok) {
    logger.warn(MODULE, "Unauthorized cron attempt", {
      hasEnvSecret: auth.hasEnvSecret,
      bearerMatch: !!auth.bearerMatch,
      customMatch: !!auth.customMatch,
      method: request.method,
    });
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const results = {};

  try {
    logger.info(MODULE, "Starting scheduled jobs", {
      timestamp: now.toISOString(),
      method: request.method,
    });

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

// Vercel Cron triggers with a GET request.
export async function loader({ request }) {
  return runCronJobs(request);
}

// External schedulers / admin test button POST to this endpoint.
export async function action({ request }) {
  return runCronJobs(request);
}
