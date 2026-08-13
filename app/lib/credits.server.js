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
