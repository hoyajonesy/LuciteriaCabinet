/**
 * Luciteria Collector Cabinet — Periodic Table Groups (18 IUPAC Groups)
 * 
 * Maps the 18 standard IUPAC periodic table groups (columns 1-18)
 * to display names, element lists, and colors for progress tracking.
 * 
 * Note: Lanthanides (Z 57-71) and Actinides (Z 89-103) are traditionally
 * placed in group 3 but displayed separately. We track them as their own
 * pseudo-groups for collection progress purposes.
 */

import { ELEMENTS_118 } from '../data/elements.server.js';

// ─── 18 IUPAC Groups + Lanthanide/Actinide series ─────────────
export const PERIODIC_GROUPS = {
  1:  { name: 'Group 1',  label: 'Alkali Metals + H',       color: '#FF6B6B' },
  2:  { name: 'Group 2',  label: 'Alkaline Earth Metals',    color: '#FFA07A' },
  3:  { name: 'Group 3',  label: 'Sc, Y, La/Ac Group',       color: '#FFD700' },
  4:  { name: 'Group 4',  label: 'Titanium Group',           color: '#DAA520' },
  5:  { name: 'Group 5',  label: 'Vanadium Group',           color: '#BDB76B' },
  6:  { name: 'Group 6',  label: 'Chromium Group',           color: '#8FBC8F' },
  7:  { name: 'Group 7',  label: 'Manganese Group',          color: '#66CDAA' },
  8:  { name: 'Group 8',  label: 'Iron Group',               color: '#20B2AA' },
  9:  { name: 'Group 9',  label: 'Cobalt Group',             color: '#4682B4' },
  10: { name: 'Group 10', label: 'Nickel Group',             color: '#6495ED' },
  11: { name: 'Group 11', label: 'Coinage Metals',           color: '#7B68EE' },
  12: { name: 'Group 12', label: 'Zinc Group',               color: '#9370DB' },
  13: { name: 'Group 13', label: 'Boron Group',              color: '#BA55D3' },
  14: { name: 'Group 14', label: 'Carbon Group',             color: '#C71585' },
  15: { name: 'Group 15', label: 'Pnictogens',               color: '#DB7093' },
  16: { name: 'Group 16', label: 'Chalcogens',               color: '#E9967A' },
  17: { name: 'Group 17', label: 'Halogens',                 color: '#F08080' },
  18: { name: 'Group 18', label: 'Noble Gases',              color: '#87CEEB' },
  // Pseudo-groups for lanthanides/actinides displayed separately
  'lanthanides': { name: 'Lanthanides', label: 'Lanthanide Series', color: '#FFDAB9' },
  'actinides':   { name: 'Actinides',   label: 'Actinide Series',   color: '#FFE4B5' },
};

/**
 * Get the IUPAC group key for an element.
 * Lanthanides (Z 57-71) → 'lanthanides'
 * Actinides (Z 89-103) → 'actinides'
 * Everything else → column number (1-18)
 */
export function getGroupKey(element) {
  if (element.group === 'Lanthanide') return 'lanthanides';
  if (element.group === 'Actinide') return 'actinides';
  return element.col; // col maps directly to IUPAC group number
}

/**
 * Get all elements belonging to a specific group key.
 */
export function getElementsByGroup(groupKey) {
  return ELEMENTS_118.filter(el => getGroupKey(el) === groupKey);
}

/**
 * Get a map of groupKey → element symbols array.
 */
export function getGroupElementMap() {
  const map = {};
  for (const el of ELEMENTS_118) {
    const key = getGroupKey(el);
    if (!map[key]) map[key] = [];
    map[key].push(el.sym);
  }
  return map;
}

/**
 * Get display info for all groups with element counts.
 */
export function getAllGroupsInfo() {
  const groupMap = getGroupElementMap();
  return Object.entries(PERIODIC_GROUPS).map(([key, info]) => ({
    key: isNaN(key) ? key : Number(key),
    ...info,
    elements: groupMap[isNaN(key) ? key : Number(key)] || [],
    count: (groupMap[isNaN(key) ? key : Number(key)] || []).length,
  }));
}

/**
 * Calculate progress for a given group key based on owned symbols.
 */
export function getGroupProgress(groupKey, ownedSymbols) {
  const elements = getElementsByGroup(groupKey);
  const ownedSet = new Set(ownedSymbols);
  const owned = elements.filter(el => ownedSet.has(el.sym));
  return {
    groupKey,
    groupInfo: PERIODIC_GROUPS[groupKey],
    total: elements.length,
    owned: owned.length,
    percentage: elements.length > 0 ? Math.round((owned.length / elements.length) * 100) : 0,
    missing: elements.filter(el => !ownedSet.has(el.sym)).map(el => el.sym),
  };
}

/**
 * Get progress across all groups.
 */
export function getAllGroupProgress(ownedSymbols) {
  return Object.keys(PERIODIC_GROUPS).map(key => {
    const groupKey = isNaN(key) ? key : Number(key);
    return getGroupProgress(groupKey, ownedSymbols);
  });
}
