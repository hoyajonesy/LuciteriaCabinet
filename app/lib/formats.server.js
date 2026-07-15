/**
 * Luciteria Collector Cabinet — Server-only Format Availability
 *
 * This file imports ELEMENTS_118 (server-only) and provides functions that
 * filter elements by the periodic_size Shopify metafield.
 *
 * Client-safe format definitions (FORMATS, FORMAT_LIST, FORMAT_IDS) live in
 * ./formats.js — import from there for React components and loaders that
 * only need the definitions.
 */

import { ELEMENTS_118 } from '../data/elements.server.js';
import { FORMATS, FORMAT_LIST, parseSizes } from './formats.js';

// Re-export the client-safe definitions for convenience
export { FORMATS, FORMAT_LIST } from './formats.js';

// ─── Availability functions ─────────────────────────────────────

/**
 * Get available element symbols for a given format.
 * Uses the periodic_size metafield (el.size) fetched from Shopify.
 * Since FORMATS key === id (e.g. '10mm_cube'), we match directly against formatId.
 */
export function getAvailableElementsForFormat(formatId) {
  // Validate it's a known format
  if (!FORMATS[formatId]) {
    return ELEMENTS_118.map(el => el.sym); // fallback: all elements
  }

  return ELEMENTS_118
    .filter(el => parseSizes(el.size).includes(formatId))
    .map(el => el.sym);
}

/**
 * Get the total collectible count for a format.
 */
export function getFormatTotalCount(formatId) {
  return getAvailableElementsForFormat(formatId).length;
}

/**
 * Collectible cap used for completion percentage.
 * Derived from the live periodic_size metafield data, so it stays in sync
 * with what Shopify actually reports for each format.
 */
export function getCollectibleCap(formatId) {
  return getAvailableElementsForFormat(formatId).length;
}

/**
 * Check if a specific element is available in a specific format.
 */
export function isElementAvailableInFormat(elementSymbol, formatId) {
  return getAvailableElementsForFormat(formatId).includes(elementSymbol);
}

/**
 * Get format progress for a user given their owned symbols per format.
 * @param {Object} ownedByFormat - { '10mm_cube': ['H', 'He', ...], 'lucite_cube': [...] }
 */
export function getFormatProgress(ownedByFormat) {
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

/**
 * Get all format info for display.
 */
export function getAllFormatsInfo() {
  return FORMAT_LIST.map(format => ({
    ...format,
    totalElements: getFormatTotalCount(format.id),
  }));
}
