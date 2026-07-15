/**
 * Luciteria Collector Cabinet — Collection Service Layer
 * 
 * Core service for managing user collection state, statistics,
 * progress tracking, and recommendations. This is the primary
 * data layer for the collection-first experience.
 */

import { prisma } from './db.server.js';
import { ELEMENTS_118 } from '../data/elements.server.js';
import { getGroupKey, getAllGroupProgress, PERIODIC_GROUPS } from './periodic-groups.js';
import { getAvailableElementsForFormat, FORMAT_LIST, getCollectibleCap } from './formats.server.js';
import { detectWishlistContext } from './wishlist-context.server.js';

// Valid collection states
export const COLLECTION_STATES = ['OWNED', 'WANTED', 'WATCHLIST', 'MISSING'];

// ─── Core CRUD ──────────────────────────────────────────────────

/**
 * Get all collection items for a user, creating defaults if none exist.
 */
export async function getUserCollection(userId) {
  const items = await prisma.collectionItem.findMany({
    where: { userId },
    orderBy: { atomicNumber: 'asc' },
  });
  return items;
}

/**
 * Get collection items filtered by state.
 */
export async function getUserCollectionByState(userId, state) {
  return prisma.collectionItem.findMany({
    where: { userId, state },
    orderBy: { atomicNumber: 'asc' },
  });
}

/**
 * Update or create a collection item state for an element.
 */
export async function updateCollectionState(userId, elementSymbol, newState, extras = {}) {
  const element = ELEMENTS_118.find(el => el.sym === elementSymbol);
  if (!element) throw new Error(`Unknown element: ${elementSymbol}`);
  if (!COLLECTION_STATES.includes(newState)) throw new Error(`Invalid state: ${newState}`);

  const existing = await prisma.collectionItem.findUnique({
    where: { userId_elementSymbol: { userId, elementSymbol } },
  });

  const oldState = existing?.state || 'MISSING';

  // Auto-detect a wishlist context label when an item enters WANTED
  // (and one hasn't been manually set yet).
  let autoContext = null;
  if (newState === 'WANTED' && !existing?.contextLabel) {
    const all = await prisma.collectionItem.findMany({
      where: { userId },
      select: { elementSymbol: true, state: true },
    });
    const ownedSymbols = all.filter(i => i.state === 'OWNED').map(i => i.elementSymbol);
    const completionPct = Math.round((ownedSymbols.length / ELEMENTS_118.length) * 100);
    autoContext = detectWishlistContext(elementSymbol, { ownedSymbols, completionPct }).contextLabel;
  }

  const data = {
    state: newState,
    ...(newState === 'OWNED' && !existing?.acquiredDate ? { acquiredDate: new Date() } : {}),
    ...(extras.format ? { format: extras.format } : {}),
    ...(extras.acquiredVia ? { acquiredVia: extras.acquiredVia } : {}),
    ...(extras.notes ? { notes: extras.notes } : {}),
    ...(autoContext ? { contextLabel: autoContext } : {}),
    ...(extras.priority !== undefined ? { priority: Number(extras.priority) } : {}),
  };

  const item = await prisma.collectionItem.upsert({
    where: { userId_elementSymbol: { userId, elementSymbol } },
    update: data,
    create: {
      userId,
      elementSymbol,
      elementName: element.name,
      atomicNumber: element.z,
      ...data,
    },
  });

  // Log the activity
  if (oldState !== newState) {
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'state_changed',
        elementSymbol,
        details: JSON.stringify({ from: oldState, to: newState, format: extras.format }),
      },
    });
  }

  return { item, oldState, newState };
}

/**
 * Bulk-set elements to OWNED (for onboarding).
 */
export async function bulkSetOwned(userId, symbols, format = null) {
  const results = [];
  for (const sym of symbols) {
    const result = await updateCollectionState(userId, sym, 'OWNED', {
      format,
      acquiredVia: 'manual',
    });
    results.push(result);
  }
  return results;
}

// ─── Statistics ─────────────────────────────────────────────────

/**
 * Get comprehensive collection statistics for a user.
 */
export async function getCollectionStats(userId, format = 'lucite_cube') {
  const items = await getUserCollection(userId);
  const stateMap = { OWNED: [], WANTED: [], WATCHLIST: [], MISSING: [] };

  for (const item of items) {
    if (stateMap[item.state]) {
      stateMap[item.state].push(item.elementSymbol);
    }
  }

  // Elements not in the collection items table are implicitly MISSING
  const trackedSymbols = new Set(items.map(i => i.elementSymbol));
  for (const el of ELEMENTS_118) {
    if (!trackedSymbols.has(el.sym)) {
      stateMap.MISSING.push(el.sym);
    }
  }

  const ownedCount = stateMap.OWNED.length;
  // Auto-calculated collectible cap for the user's format drives completion %.
  const cap = getCollectibleCap(format);

  return {
    total: cap,
    cap,
    format,
    owned: ownedCount,
    wanted: stateMap.WANTED.length,
    watchlist: stateMap.WATCHLIST.length,
    missing: stateMap.MISSING.length,
    percentage: cap > 0 ? Math.min(100, Math.round((ownedCount / cap) * 100)) : 0,
    ownedSymbols: stateMap.OWNED,
    wantedSymbols: stateMap.WANTED,
    watchlistSymbols: stateMap.WATCHLIST,
    missingSymbols: stateMap.MISSING,
  };
}

/**
 * Get progress broken down by periodic table group.
 */
export async function getProgressByGroup(userId) {
  const stats = await getCollectionStats(userId);
  return getAllGroupProgress(stats.ownedSymbols);
}

/**
 * Get progress broken down by collection format.
 */
export async function getProgressByFormat(userId) {
  const items = await prisma.collectionItem.findMany({
    where: { userId, state: 'OWNED' },
  });

  // Group by format
  const ownedByFormat = {};
  for (const item of items) {
    const fmt = item.format || 'unspecified';
    if (!ownedByFormat[fmt]) ownedByFormat[fmt] = [];
    ownedByFormat[fmt].push(item.elementSymbol);
  }

  return FORMAT_LIST.map(format => {
    const available = getAvailableElementsForFormat(format.id);
    const owned = (ownedByFormat[format.id] || []).filter(sym => available.includes(sym));
    return {
      formatId: format.id,
      formatName: format.name,
      icon: format.icon,
      total: available.length,
      owned: owned.length,
      percentage: available.length > 0 ? Math.round((owned.length / available.length) * 100) : 0,
      missing: available.filter(sym => !owned.includes(sym)),
    };
  });
}

// ─── Recommendations ────────────────────────────────────────────

/**
 * Get groups closest to completion (best ROI for the collector).
 */
export async function getClosestToCompletion(userId, limit = 5) {
  const groupProgress = await getProgressByGroup(userId);

  return groupProgress
    .filter(g => g.percentage > 0 && g.percentage < 100) // In progress, not done
    .sort((a, b) => {
      // Sort by fewest missing elements first
      const aMissing = a.total - a.owned;
      const bMissing = b.total - b.owned;
      return aMissing - bMissing;
    })
    .slice(0, limit);
}

/**
 * Get the single "next best" element to acquire.
 * Algorithm: Pick the element that completes the most near-complete groups.
 */
export async function getNextBestRecommendation(userId) {
  const stats = await getCollectionStats(userId);
  const ownedSet = new Set(stats.ownedSymbols);
  const groupProgress = await getProgressByGroup(userId);

  // Score each missing element by how many near-complete groups it would help
  const scores = {};
  for (const group of groupProgress) {
    if (group.percentage >= 100) continue;
    const missingCount = group.missing.length;
    // Higher score for groups that need fewer elements
    const groupScore = missingCount > 0 ? (1 / missingCount) * 10 : 0;
    for (const sym of group.missing) {
      scores[sym] = (scores[sym] || 0) + groupScore;
    }
  }

  // Prioritize wanted elements
  for (const sym of stats.wantedSymbols) {
    scores[sym] = (scores[sym] || 0) + 5;
  }

  // Find the best scoring missing element
  const sorted = Object.entries(scores)
    .filter(([sym]) => !ownedSet.has(sym))
    .sort((a, b) => b[1] - a[1]);

  if (sorted.length === 0) return null;

  const [bestSym] = sorted[0];
  const element = ELEMENTS_118.find(el => el.sym === bestSym);

  return {
    element,
    score: sorted[0][1],
    reason: stats.wantedSymbols.includes(bestSym)
      ? 'On your wanted list and helps complete groups'
      : 'Helps complete the most near-finished groups',
  };
}

// Popular "gateway" elements that make great starter acquisitions.
const GATEWAY_ELEMENTS = new Set([
  'C', 'Al', 'Si', 'Fe', 'Cu', 'Zn', 'Ni', 'Ti', 'W', 'Sn',
  'Pb', 'Mg', 'S', 'Ag', 'Co', 'Cr', 'Mn', 'Bi', 'Au', 'Ca',
]);
// Precious metals (expensive) — used to flag budget-friendly picks.
const EXPENSIVE = new Set(['Re', 'Rh', 'Au', 'Os', 'Ru', 'Pd', 'Ir', 'Pt']);

/**
 * Get the top N "next best" elements to acquire, ranked by priority:
 *   1. Completes a near-finished group
 *   2. On the wishlist (WANTED)
 *   3. Budget-friendly (common, non-precious, non-radioactive)
 *   4. Popular / gateway element
 *
 * @param {string} userId
 * @param {number} limit
 * @returns {Array<{ element, score, reason, priority }>}
 */
export async function getNextBestRecommendations(userId, limit = 3, format = 'lucite_cube') {
  const stats = await getCollectionStats(userId, format);
  const ownedSet = new Set(stats.ownedSymbols);
  const wantedSet = new Set(stats.wantedSymbols);
  const groupProgress = await getProgressByGroup(userId);

  // Track, per symbol, the strongest group it would help complete.
  const groupScore = {};
  const bestGroup = {};
  for (const group of groupProgress) {
    if (group.percentage >= 100) continue;
    const missingCount = group.missing.length;
    if (missingCount === 0) continue;
    const contribution = (1 / missingCount) * 10; // fewer missing → higher
    for (const sym of group.missing) {
      if (contribution > (groupScore[sym] || 0)) {
        bestGroup[sym] = { label: group.groupInfo?.label || group.groupKey, missingCount };
      }
      groupScore[sym] = (groupScore[sym] || 0) + contribution;
    }
  }

  const candidates = ELEMENTS_118.filter((el) => !ownedSet.has(el.sym));

  const scored = candidates.map((el) => {
    const sym = el.sym;
    let score = 0;
    let priority = 4;
    let reason = 'Expands your collection';

    const isBudget = el.z < 84 && !EXPENSIVE.has(sym);
    const isGateway = GATEWAY_ELEMENTS.has(sym);

    if (isBudget) { score += 50; }
    if (isGateway) { score += 30; }

    if (wantedSet.has(sym)) {
      score += 400;
      priority = 2;
      reason = 'On your wishlist';
    }

    const gScore = groupScore[sym] || 0;
    if (gScore > 0) {
      score += gScore * 100;
      const bg = bestGroup[sym];
      // Completing a group (1-2 left) is the top priority.
      if (bg && bg.missingCount <= 2) {
        priority = 1;
        reason = `Completes your ${bg.label} set`;
      } else if (priority > 3) {
        priority = 3;
        reason = `Builds your ${bg ? bg.label : 'collection'} set`;
      }
    }

    if (priority === 4) {
      if (isBudget) reason = 'Budget-friendly pick';
      if (isGateway) reason = 'Popular starter element';
    }

    return { element: el, score, reason, priority };
  });

  return scored
    .sort((a, b) => a.priority - b.priority || b.score - a.score || a.element.z - b.element.z)
    .slice(0, limit);
}

/**
 * Get missing elements available for purchase (for shop view).
 */
export async function getMissingItemsForShop(userId) {
  const stats = await getCollectionStats(userId);
  const missingElements = ELEMENTS_118.filter(el => stats.missingSymbols.includes(el.sym));

  return missingElements.map(el => ({
    ...el,
    isWanted: stats.wantedSymbols.includes(el.sym),
    isWatchlist: stats.watchlistSymbols.includes(el.sym),
    groupKey: getGroupKey(el),
    groupInfo: PERIODIC_GROUPS[getGroupKey(el)],
  }));
}

// ─── Activity Feed ──────────────────────────────────────────────

/**
 * Get recent activity for a user.
 */
export async function getActivityFeed(userId, limit = 20) {
  return prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

// ─── Goals ──────────────────────────────────────────────────────

/**
 * Set a collection goal for a user.
 */
export async function setCollectionGoal(userId, goalData) {
  const goal = await prisma.collectionGoalV2.create({
    data: {
      userId,
      goalType: goalData.goalType,
      targetFormat: goalData.targetFormat || null,
      targetGroup: goalData.targetGroup || null,
      targetCount: goalData.targetCount || null,
      title: goalData.title,
    },
  });

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'goal_set',
      details: JSON.stringify({ goalType: goalData.goalType, title: goalData.title }),
    },
  });

  return goal;
}

/**
 * Get active goals for a user.
 */
export async function getActiveGoals(userId) {
  return prisma.collectionGoalV2.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: 'desc' },
  });
}

// ─── Admin: Collection Metrics ──────────────────────────────────

/**
 * Get platform-wide collection metrics for admin dashboard.
 */
export async function getAdminCollectionMetrics() {
  const totalUsers = await prisma.user.count();
  const usersWithItems = await prisma.collectionItem.groupBy({
    by: ['userId'],
    _count: true,
  });

  const stateDistribution = await prisma.collectionItem.groupBy({
    by: ['state'],
    _count: true,
  });

  const topCollectors = await prisma.collectionItem.groupBy({
    by: ['userId'],
    where: { state: 'OWNED' },
    _count: true,
    orderBy: { _count: { userId: 'desc' } },
    take: 10,
  });

  const mostWanted = await prisma.collectionItem.groupBy({
    by: ['elementSymbol'],
    where: { state: 'WANTED' },
    _count: true,
    orderBy: { _count: { elementSymbol: 'desc' } },
    take: 10,
  });

  return {
    totalUsers,
    activeCollectors: usersWithItems.length,
    stateDistribution: stateDistribution.reduce((acc, s) => {
      acc[s.state] = s._count;
      return acc;
    }, {}),
    topCollectors: topCollectors.map(tc => ({
      userId: tc.userId,
      ownedCount: tc._count,
    })),
    mostWantedElements: mostWanted.map(mw => ({
      elementSymbol: mw.elementSymbol,
      wantedByCount: mw._count,
    })),
  };
}
