/**
 * Store Credit System
 * 
 * Manages monthly credit grants, spending, refunds, and balance queries.
 * All transactions are logged to the CreditTransaction table.
 */
import { prisma } from "./db.server.js";

/**
 * Grant monthly store credit to a user (scheduled job)
 */
export async function grantMonthlyCredit(userId, amount) {
  if (amount <= 0) throw new Error("Credit amount must be positive");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balanceBefore = user.storeCreditBalance;
  const balanceAfter = balanceBefore + amount;

  const [updatedUser, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { storeCreditBalance: balanceAfter },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "MONTHLY_GRANT",
        description: `Monthly membership credit grant — $${amount.toFixed(2)}`,
        balanceBefore,
        balanceAfter,
      },
    }),
  ]);

  return { balance: updatedUser.storeCreditBalance, transaction };
}

/**
 * Spend store credits (e.g., purchasing a pack)
 */
export async function spendCredit(userId, amount, description) {
  if (amount <= 0) throw new Error("Spend amount must be positive");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  if (user.storeCreditBalance < amount) {
    throw new Error(`Insufficient credit balance. Available: $${user.storeCreditBalance.toFixed(2)}, Required: $${amount.toFixed(2)}`);
  }

  const balanceBefore = user.storeCreditBalance;
  const balanceAfter = balanceBefore - amount;

  const [updatedUser, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { storeCreditBalance: balanceAfter },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -amount,
        type: "SPENT",
        description,
        balanceBefore,
        balanceAfter,
      },
    }),
  ]);

  return { balance: updatedUser.storeCreditBalance, transaction };
}

/**
 * Refund store credits
 */
export async function refundCredit(userId, amount, description) {
  if (amount <= 0) throw new Error("Refund amount must be positive");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balanceBefore = user.storeCreditBalance;
  const balanceAfter = balanceBefore + amount;

  const [updatedUser, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { storeCreditBalance: balanceAfter },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "REFUND",
        description,
        balanceBefore,
        balanceAfter,
      },
    }),
  ]);

  return { balance: updatedUser.storeCreditBalance, transaction };
}

/**
 * Get current credit balance for a user
 */
export async function getCreditBalance(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storeCreditBalance: true },
  });
  return user?.storeCreditBalance ?? 0;
}

/**
 * Get credit transaction history for a user
 */
export async function getCreditHistory(userId, limit = 50) {
  return prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

/**
 * Simulate monthly credit grant for all active subscribers
 * (Admin-triggered for prototype; would be a cron job in production)
 */
export async function grantAllMonthlyCredits() {
  const activeUsers = await prisma.user.findMany({
    where: { subscriptionStatus: "ACTIVE" },
    include: { membershipTier: true },
  });

  const results = [];
  for (const user of activeUsers) {
    if (!user.membershipTier) continue;
    try {
      const result = await grantMonthlyCredit(user.id, user.membershipTier.storeCredit);
      results.push({ userId: user.id, email: user.email, credited: user.membershipTier.storeCredit, success: true });
    } catch (err) {
      results.push({ userId: user.id, email: user.email, error: err.message, success: false });
    }
  }

  return results;
}

/**
 * Grant subscription carry-forward credit (FR-20/21)
 * Idempotent per (subscriptionContractId, billingCycle)
 * 
 * @param {string} userId
 * @param {string} subscriptionContractId
 * @param {string} billingCycle - ISO date string or cycle identifier (e.g., "2026-08")
 * @param {number} amount - Credit amount to grant
 * @param {string} reason - Human-readable reason for the credit
 * @returns {Promise<{ balance: number, transaction: Object, wasAlreadyGranted: boolean }>}
 */
export async function grantCarryForwardCredit(userId, subscriptionContractId, billingCycle, amount, reason) {
  if (amount <= 0) throw new Error("Credit amount must be positive");
  if (!subscriptionContractId) throw new Error("subscriptionContractId is required for carry-forward credits");
  if (!billingCycle) throw new Error("billingCycle is required for carry-forward credits");

  // Check if this credit was already granted (idempotency check per FR-21)
  const existing = await prisma.creditTransaction.findFirst({
    where: {
      subscriptionContractId,
      billingCycle,
      type: "SUBSCRIPTION_CARRYFORWARD",
    },
  });

  if (existing) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { storeCreditBalance: true } });
    return {
      balance: user?.storeCreditBalance ?? 0,
      transaction: existing,
      wasAlreadyGranted: true,
    };
  }

  // Grant the credit
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balanceBefore = user.storeCreditBalance;
  const balanceAfter = balanceBefore + amount;

  const [updatedUser, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { storeCreditBalance: balanceAfter },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "SUBSCRIPTION_CARRYFORWARD",
        description: reason || `Subscription carry-forward credit — no eligible items for cycle ${billingCycle}`,
        balanceBefore,
        balanceAfter,
        subscriptionContractId,
        billingCycle,
      },
    }),
  ]);

  return { balance: updatedUser.storeCreditBalance, transaction, wasAlreadyGranted: false };
}

/**
 * Grant skip-banked store credit (Swap & Skip Window, FR-12).
 *
 * A subscriber who skips a held cycle banks the cycle's assigned value as store
 * credit. Reuses the existing CreditTransaction ledger and the SAME
 * (subscriptionContractId, billingCycle) idempotency key as empty-pool
 * carry-forward credit.
 *
 * CRITICAL (FR-12 / Section 4): the underlying unique DB constraint
 * `subscription_cycle_credit` is TYPE-AGNOSTIC — it allows at most one
 * CreditTransaction row per (subscriptionContractId, billingCycle) regardless of
 * `type`. The dedup check here therefore looks for ANY existing row for that
 * (contract, cycle) pair (NOT filtered to type = SUBSCRIPTION_SKIP_CREDIT), so a
 * skip correctly detects — and never collides at the raw DB level with — an
 * empty-pool carry-forward row already granted for the same cycle.
 *
 * @param {string} userId
 * @param {string} subscriptionContractId
 * @param {string} billingCycle - cycle identifier (e.g. "2026-08")
 * @param {number} amount
 * @param {string} [reason]
 * @param {Object} [opts]
 * @param {Date|null} [opts.expiresAt] - optional expiry timestamp for the credit
 * @returns {Promise<{ balance: number, transaction: Object, wasAlreadyGranted: boolean, collidedType?: string }>}
 */
export async function grantSkipCredit(userId, subscriptionContractId, billingCycle, amount, reason, opts = {}) {
  const { expiresAt = null } = opts;
  if (amount <= 0) throw new Error("Credit amount must be positive");
  if (!subscriptionContractId) throw new Error("subscriptionContractId is required for skip credits");
  if (!billingCycle) throw new Error("billingCycle is required for skip credits");

  // Type-AGNOSTIC idempotency / collision check (FR-12).
  const existing = await prisma.creditTransaction.findFirst({
    where: { subscriptionContractId, billingCycle },
  });

  if (existing) {
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { storeCreditBalance: true } });
    return {
      balance: user?.storeCreditBalance ?? 0,
      transaction: existing,
      wasAlreadyGranted: true,
      collidedType: existing.type,
    };
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const balanceBefore = user.storeCreditBalance;
  const balanceAfter = balanceBefore + amount;

  const [updatedUser, transaction] = await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: { storeCreditBalance: balanceAfter },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount,
        type: "SUBSCRIPTION_SKIP_CREDIT",
        description: reason || `Skipped subscription cycle ${billingCycle} — credited $${amount.toFixed(2)}`,
        balanceBefore,
        balanceAfter,
        subscriptionContractId,
        billingCycle,
        expiresAt,
      },
    }),
  ]);

  return { balance: updatedUser.storeCreditBalance, transaction, wasAlreadyGranted: false };
}



/**
 * Stamp a post-cancellation expiry on a contract's banked skip credits
 * (Swap & Skip Window, FR-18 + policy: usable for N days post-cancellation,
 * then expire; no refund).
 *
 * Called when a subscription is cancelled. Sets `expiresAt = now + days` on
 * every still-usable skip credit for the contract. Credits already expired
 * (expiredAt set) are left alone. Existing earlier expiries are not pushed out;
 * only credits without an expiry, or with a LATER expiry than the cancellation
 * deadline, are tightened to the cancellation deadline so cancellation never
 * extends a credit's life.
 *
 * @param {string} subscriptionContractId
 * @param {number} days - skipCreditPostCancellationDays (e.g. 90)
 * @param {Object} [opts]
 * @param {Date} [opts.now]
 * @returns {Promise<{ stamped: number, deadline: Date }>}
 */
export async function expireSkipCreditsOnCancellation(subscriptionContractId, days, opts = {}) {
  const now = opts.now || new Date();
  if (!subscriptionContractId) throw new Error("subscriptionContractId is required");
  const deadline = new Date(now.getTime() + (Number(days) || 0) * 86400000);

  const credits = await prisma.creditTransaction.findMany({
    where: {
      subscriptionContractId,
      type: "SUBSCRIPTION_SKIP_CREDIT",
      expiredAt: null,
      amount: { gt: 0 },
    },
    select: { id: true, expiresAt: true },
  });

  let stamped = 0;
  for (const c of credits) {
    // Never extend a credit's life: only set/tighten the expiry.
    if (c.expiresAt && c.expiresAt.getTime() <= deadline.getTime()) continue;
    await prisma.creditTransaction.update({
      where: { id: c.id },
      data: { expiresAt: deadline },
    });
    stamped++;
  }

  return { stamped, deadline };
}

/**
 * Credit-expiry sweep (Swap & Skip Window). Claws back the remaining value of
 * skip credits whose `expiresAt` has passed and stamps `expiredAt` so the same
 * credit is never swept twice (idempotent).
 *
 * The store credit balance is a single pooled figure (no per-lot tracking), so
 * an expiring credit's claw-back is capped at the user's CURRENT balance — the
 * balance can never go negative, and value the subscriber already spent is not
 * double-counted.
 *
 * Concurrency-safe: expiry is claimed with a conditional updateMany on
 * `expiredAt: null` (single-winner), mirroring the atomic-claim pattern used
 * elsewhere in this feature.
 *
 * @param {Object} [params]
 * @param {Date} [params.now]
 * @returns {Promise<{ scanned: number, expired: number, clawedBack: number, errors: number }>}
 */
export async function runSkipCreditExpirySweep({ now = new Date() } = {}) {
  const due = await prisma.creditTransaction.findMany({
    where: {
      type: "SUBSCRIPTION_SKIP_CREDIT",
      expiredAt: null,
      amount: { gt: 0 },
      expiresAt: { not: null, lte: now },
    },
  });

  const summary = { scanned: due.length, expired: 0, clawedBack: 0, errors: 0 };

  for (const credit of due) {
    try {
      // Atomically claim the expiry (single-winner).
      const claim = await prisma.creditTransaction.updateMany({
        where: { id: credit.id, expiredAt: null },
        data: { expiredAt: now },
      });
      if (claim.count !== 1) continue; // someone else swept it

      const user = await prisma.user.findUnique({
        where: { id: credit.userId },
        select: { storeCreditBalance: true },
      });
      if (!user) {
        summary.errors++;
        continue;
      }

      const clawBack = Math.min(credit.amount, Math.max(0, user.storeCreditBalance));
      if (clawBack > 0) {
        const balanceBefore = user.storeCreditBalance;
        const balanceAfter = balanceBefore - clawBack;
        await prisma.$transaction([
          prisma.user.update({
            where: { id: credit.userId },
            data: { storeCreditBalance: balanceAfter },
          }),
          prisma.creditTransaction.create({
            data: {
              userId: credit.userId,
              amount: -clawBack,
              type: "SUBSCRIPTION_SKIP_CREDIT_EXPIRED",
              description: `Skip credit expired — $${clawBack.toFixed(2)} clawed back (cycle ${credit.billingCycle || "n/a"})`,
              balanceBefore,
              balanceAfter,
              subscriptionContractId: null,
              billingCycle: null,
            },
          }),
        ]);
        summary.clawedBack += clawBack;
      }
      summary.expired++;
    } catch (e) {
      summary.errors++;
    }
  }

  return summary;
}
