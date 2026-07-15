/**
 * Luciteria Collector Cabinet — Billing Utilities (Phase 2)
 * 
 * Dual billing model:
 *  - First charge: Signup day (immediate)
 *  - Subsequent charges: 1st of each month
 *  - 5-day edge case: If signup is within 5 days of month end (26th-31st),
 *    first renewal is 1st of month after next (skip the imminent 1st)
 * 
 * Grandfathering:
 *  - Price locked for 12 months from signup
 *  - Clock pauses during subscription pause
 *  - After 12 months, price adjusts to current rate
 */

/**
 * Calculate the next billing date based on signup date and current date
 * 
 * @param {string|Date} signupDate - When the customer first subscribed
 * @param {string|Date} currentDate - Today's date
 * @returns {Date} Next billing date
 */
function calculateNextBillingDate(signupDate, currentDate = new Date()) {
  const signup = new Date(signupDate);
  const now = new Date(currentDate);
  
  const signupDay = signup.getDate();
  const signupMonth = signup.getMonth();
  const signupYear = signup.getFullYear();
  
  // If still in signup month, first billing already happened at signup
  // Next billing is 1st of next month (or month after if 5-day edge case)
  if (now.getFullYear() === signupYear && now.getMonth() === signupMonth) {
    // 5-day edge case: signup on 26th-31st → skip the next 1st
    if (signupDay >= 26) {
      // Skip next month's 1st, bill on 1st of month+2
      const target = new Date(signupYear, signupMonth + 2, 1);
      return target;
    }
    // Normal: next billing is 1st of next month
    return new Date(signupYear, signupMonth + 1, 1);
  }
  
  // For subsequent months: always 1st of the month
  // Find the next 1st that's in the future
  let nextFirst = new Date(now.getFullYear(), now.getMonth(), 1);
  if (nextFirst <= now) {
    nextFirst = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  }
  return nextFirst;
}

/**
 * Calculate billing schedule for display
 * Returns an array of upcoming billing dates
 * 
 * @param {string|Date} signupDate
 * @param {number} count - Number of future billing dates to generate
 * @param {string|Date} currentDate
 * @returns {Array<{date: Date, amount: number, isFirst: boolean}>}
 */
function generateBillingSchedule(signupDate, monthlyPrice, count = 6, currentDate = new Date()) {
  const schedule = [];
  const signup = new Date(signupDate);
  const now = new Date(currentDate);
  
  // First billing was at signup
  if (signup >= now) {
    schedule.push({
      date: new Date(signup),
      amount: monthlyPrice,
      isFirst: true,
      label: "Signup charge",
    });
  }
  
  let nextDate = calculateNextBillingDate(signupDate, currentDate);
  
  for (let i = 0; i < count && schedule.length < count; i++) {
    if (nextDate >= now) {
      schedule.push({
        date: new Date(nextDate),
        amount: monthlyPrice,
        isFirst: false,
        label: `Monthly renewal`,
      });
    }
    // Advance to next month's 1st
    nextDate = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 1);
  }
  
  return schedule.slice(0, count);
}

/**
 * Grandfathering logic
 * 
 * Price is locked for 12 months from signup. Pause time extends the lock.
 * 
 * @param {Object} params
 * @param {string|Date} params.signupDate - Original subscription start
 * @param {number} params.originalPrice - Locked-in price
 * @param {number} params.currentPrice - Current plan price
 * @param {number} params.pausedDays - Total days paused (extends grandfather period)
 * @param {string|Date} params.currentDate
 * @returns {Object} { isGrandfathered, price, expiresAt, daysRemaining, savings }
 */
function calculateGrandfatheredPrice({
  signupDate,
  originalPrice,
  currentPrice,
  pausedDays = 0,
  currentDate = new Date(),
}) {
  const signup = new Date(signupDate);
  const now = new Date(currentDate);
  
  // 12 months from signup + paused days
  const grandfatherEnd = new Date(signup);
  grandfatherEnd.setMonth(grandfatherEnd.getMonth() + 12);
  grandfatherEnd.setDate(grandfatherEnd.getDate() + pausedDays);
  
  const isGrandfathered = now < grandfatherEnd;
  const daysRemaining = isGrandfathered
    ? Math.ceil((grandfatherEnd - now) / (1000 * 60 * 60 * 24))
    : 0;
  
  const effectivePrice = isGrandfathered ? originalPrice : currentPrice;
  const monthlySavings = isGrandfathered ? Math.max(0, currentPrice - originalPrice) : 0;
  
  return {
    isGrandfathered,
    price: effectivePrice,
    originalPrice,
    currentPrice,
    expiresAt: grandfatherEnd.toISOString().split("T")[0],
    daysRemaining,
    monthlySavings,
    annualSavings: monthlySavings * 12,
  };
}

/**
 * Calculate total paused days for a subscription
 * 
 * @param {Array} pauseHistory - Array of { pausedAt, resumedAt } objects
 * @returns {number} Total days paused
 */
function calculatePausedDays(pauseHistory = []) {
  let totalDays = 0;
  for (const pause of pauseHistory) {
    const start = new Date(pause.pausedAt);
    const end = pause.resumedAt ? new Date(pause.resumedAt) : new Date();
    totalDays += Math.ceil((end - start) / (1000 * 60 * 60 * 24));
  }
  return totalDays;
}

/**
 * Determine if a signup date falls within the 5-day edge case window
 * (26th-31st of any month)
 */
function isEdgeCaseSignup(signupDate) {
  const day = new Date(signupDate).getDate();
  return day >= 26;
}

/**
 * Format billing summary for display
 */
function getBillingSummary(subscription, currentDate = new Date()) {
  if (!subscription) return null;
  
  const nextBilling = calculateNextBillingDate(subscription.startDate, currentDate);
  const isEdge = isEdgeCaseSignup(subscription.startDate);
  
  const grandfather = calculateGrandfatheredPrice({
    signupDate: subscription.startDate,
    originalPrice: subscription.originalPrice || subscription.priceUsd,
    currentPrice: subscription.currentPrice || subscription.priceUsd,
    pausedDays: subscription.pausedDays || 0,
    currentDate,
  });
  
  return {
    nextBillingDate: nextBilling.toISOString().split("T")[0],
    billingDay: "1st of each month",
    signupDate: subscription.startDate,
    isEdgeCaseSignup: isEdge,
    edgeCaseNote: isEdge
      ? "Your first renewal was delayed because you signed up near month-end."
      : null,
    grandfather,
    monthlyAmount: grandfather.price,
    status: subscription.status,
  };
}

export {
  calculateNextBillingDate,
  generateBillingSchedule,
  calculateGrandfatheredPrice,
  calculatePausedDays,
  isEdgeCaseSignup,
  getBillingSummary,
};
