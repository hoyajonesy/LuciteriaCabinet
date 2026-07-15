/**
 * Luciteria Collector Cabinet — Wishlist Context Detection (Phase 2C)
 *
 * Auto-assigns a semantic context label to wishlist items so collectors
 * can prioritise purchases. Labels:
 *   - CORE          : foundational gaps, common/affordable elements
 *   - EXPLORATION   : mid-range, broadening the collection
 *   - ASPIRATIONAL  : expensive or globally rare "grail" items
 *   - UPGRADE_TARGET: already owned in another format
 */

import { prisma } from './db.server.js';
import { ELEMENTS_118, isPreciousMetal } from '../data/elements.server.js';

export const CONTEXT_LABELS = {
  CORE: { label: 'Core', color: '#1976D2', description: 'Foundational gaps to fill first' },
  EXPLORATION: { label: 'Exploration', color: '#388E3C', description: 'Broaden your collection' },
  ASPIRATIONAL: { label: 'Aspirational', color: '#C5960C', description: 'Grail-tier targets' },
  UPGRADE_TARGET: { label: 'Upgrade', color: '#7B1FA2', description: 'Owned in another format' },
};

/**
 * Detect the most appropriate context for a wishlist element.
 *
 * @param {string} elementSymbol
 * @param {object} ctx - { ownedSymbols: string[], completionPct: number }
 * @returns {{ contextLabel: string, reason: string }}
 */
export function detectWishlistContext(elementSymbol, ctx = {}) {
  const { ownedSymbols = [], completionPct = 0 } = ctx;
  const ownedSet = new Set(ownedSymbols);
  const element = ELEMENTS_118.find((el) => el.sym === elementSymbol);

  // Upgrade target: already owns this element (e.g. different format)
  if (ownedSet.has(elementSymbol)) {
    return { contextLabel: 'UPGRADE_TARGET', reason: 'You already own this element — likely a format upgrade' };
  }

  // Aspirational: precious metals & late actinides are expensive/rare grails
  if (element && (isPreciousMetal(elementSymbol) || element.z >= 89)) {
    return { contextLabel: 'ASPIRATIONAL', reason: 'A rare, high-value element' };
  }

  // Core vs Exploration based on overall completion
  if (completionPct < 50) {
    return { contextLabel: 'CORE', reason: 'Fills a foundational gap early in your collection' };
  }

  return { contextLabel: 'EXPLORATION', reason: 'Broadens an already-established collection' };
}

/**
 * Persist a detected/overridden context label on the wishlist item.
 */
export async function setWishlistContext(userId, elementSymbol, contextLabel) {
  if (!CONTEXT_LABELS[contextLabel]) throw new Error(`Invalid context: ${contextLabel}`);
  return prisma.collectionItem.updateMany({
    where: { userId, elementSymbol },
    data: { contextLabel },
  });
}

/**
 * Admin: context distribution across all WANTED items.
 */
export async function getContextDistribution() {
  const rows = await prisma.collectionItem.groupBy({
    by: ['contextLabel'],
    where: { state: 'WANTED' },
    _count: true,
  });
  const dist = { CORE: 0, EXPLORATION: 0, ASPIRATIONAL: 0, UPGRADE_TARGET: 0, UNLABELED: 0 };
  for (const r of rows) {
    const key = r.contextLabel || 'UNLABELED';
    dist[key] = (dist[key] || 0) + r._count;
  }
  return dist;
}
