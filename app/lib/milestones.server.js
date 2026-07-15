/**
 * Luciteria Collector Cabinet — Milestones Service
 * 
 * Auto-detects achievements based on collection progress.
 * Checks are run after each collection state change.
 */

import { prisma } from './db.server.js';
import { ELEMENTS_118 } from '../data/elements.server.js';
import { getGroupKey, PERIODIC_GROUPS, getElementsByGroup } from './periodic-groups.js';

// ─── Milestone Definitions ──────────────────────────────────────

const MILESTONE_DEFS = [
  // Count-based milestones
  { type: 'first_element',  title: 'First Element!',           icon: '🎉', description: 'Added your first element to your collection', check: (owned) => owned.length >= 1 },
  { type: 'count_10',       title: 'Decadent Decade',          icon: '🔟', description: 'Own 10 or more elements',                    check: (owned) => owned.length >= 10 },
  { type: 'count_25',       title: 'Quarter Century',          icon: '🥈', description: 'Own 25 or more elements',                    check: (owned) => owned.length >= 25 },
  { type: 'count_50',       title: 'Half Way There',           icon: '⭐', description: 'Own 50 or more elements — halfway!',         check: (owned) => owned.length >= 50 },
  { type: 'count_75',       title: 'Three Quarters',           icon: '🌟', description: 'Own 75 or more elements',                    check: (owned) => owned.length >= 75 },
  { type: 'count_100',      title: 'Century Club',             icon: '💯', description: 'Own 100 or more elements',                   check: (owned) => owned.length >= 100 },
  { type: 'full_set',       title: 'The Completionist',        icon: '👑', description: 'Own all 118 elements — legendary!',          check: (owned) => owned.length >= 118 },
];

// Group-based milestones (auto-generated for each group)
const GROUP_MILESTONES = Object.entries(PERIODIC_GROUPS).map(([key, info]) => ({
  type: `group_${key}`,
  title: `${info.label} Master`,
  icon: '🏅',
  description: `Completed the entire ${info.label}`,
  check: (owned) => {
    const groupKey = isNaN(key) ? key : Number(key);
    const groupElements = getElementsByGroup(groupKey);
    return groupElements.length > 0 && groupElements.every(el => owned.includes(el.sym));
  },
  metadata: { groupKey: key },
}));

const ALL_MILESTONES = [...MILESTONE_DEFS, ...GROUP_MILESTONES];

// ─── Milestone Checking ─────────────────────────────────────────

/**
 * Check all milestones for a user and award any newly earned ones.
 * Call this after any collection state change.
 * 
 * @returns {Array} Newly earned milestones
 */
export async function checkMilestones(userId) {
  // Get current owned elements
  const ownedItems = await prisma.collectionItem.findMany({
    where: { userId, state: 'OWNED' },
    select: { elementSymbol: true },
  });
  const ownedSymbols = ownedItems.map(i => i.elementSymbol);

  // Get already-earned milestones
  const existing = await prisma.milestone.findMany({
    where: { userId },
    select: { type: true },
  });
  const earnedTypes = new Set(existing.map(m => m.type));

  // Check each milestone definition
  const newlyEarned = [];
  for (const def of ALL_MILESTONES) {
    if (earnedTypes.has(def.type)) continue; // Already earned
    if (!def.check(ownedSymbols)) continue;  // Not yet achieved

    // Award the milestone
    const milestone = await prisma.milestone.create({
      data: {
        userId,
        type: def.type,
        title: def.title,
        description: def.description,
        icon: def.icon,
        metadata: JSON.stringify(def.metadata || {}),
      },
    });

    // Log it
    await prisma.activityLog.create({
      data: {
        userId,
        action: 'milestone_earned',
        details: JSON.stringify({ type: def.type, title: def.title }),
      },
    });

    newlyEarned.push(milestone);
  }

  return newlyEarned;
}

/**
 * Get all milestones for a user (earned and unearned).
 */
export async function getUserMilestones(userId) {
  const earned = await prisma.milestone.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });
  const earnedTypes = new Set(earned.map(m => m.type));

  // Get current owned count for progress context
  const ownedCount = await prisma.collectionItem.count({
    where: { userId, state: 'OWNED' },
  });

  const all = ALL_MILESTONES.map(def => {
    const earnedRecord = earned.find(e => e.type === def.type);
    return {
      type: def.type,
      title: def.title,
      description: def.description,
      icon: def.icon,
      isEarned: earnedTypes.has(def.type),
      earnedAt: earnedRecord?.earnedAt || null,
    };
  });

  return { milestones: all, ownedCount, totalEarned: earned.length, totalPossible: ALL_MILESTONES.length };
}
