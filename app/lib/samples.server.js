/**
 * Luciteria Collector Cabinet — Element Samples Service (Phase 2)
 *
 * A collector can own MULTIPLE physical specimens ("samples") of the same
 * element (e.g. a 10mm cube AND an ampoule of Mercury). Each sample carries
 * its own provenance: acquisition date, source, price paid, condition,
 * format, storage location and free-text notes.
 *
 * Samples hang off a CollectionItem (1:many). Saving samples for an element
 * implicitly marks it OWNED. This service also powers the dashboard
 * "Total Invested" card by summing pricePaid across every sample.
 */

import { prisma } from './db.server.js';
import { ELEMENTS_118 } from '../data/elements.server.js';

export const CONDITIONS = ['Mint', 'Excellent', 'Good', 'Fair', 'Damaged'];

/**
 * The set of format keys a sample may be saved with is the set of ACTIVE
 * formats defined in Admin → Formats (the single source of truth). Loaded
 * fresh on each save so newly-added / renamed / deactivated formats are always
 * honored. Any value not in this set is stored as null.
 */
async function getValidFormatKeys() {
  const rows = await prisma.format.findMany({
    where: { isActive: true },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key).filter(Boolean));
}

/**
 * Ensure a CollectionItem exists for (user, element). Returns the item.
 */
async function ensureCollectionItem(userId, elementSymbol, markOwned = false) {
  const element = ELEMENTS_118.find((el) => el.sym === elementSymbol);
  if (!element) throw new Error(`Unknown element: ${elementSymbol}`);

  return prisma.collectionItem.upsert({
    where: { userId_elementSymbol: { userId, elementSymbol } },
    update: markOwned ? { state: 'OWNED' } : {},
    create: {
      userId,
      elementSymbol,
      elementName: element.name,
      atomicNumber: element.z,
      state: 'OWNED',
    },
  });
}

/**
 * Get all samples for one element, newest first.
 */
export async function getSamples(userId, elementSymbol) {
  return prisma.elementSample.findMany({
    where: { userId, elementSymbol },
    orderBy: { createdAt: 'asc' },
  });
}

/**
 * Get a map of { [sym]: count } of how many samples a user has per element.
 */
export async function getSampleCounts(userId) {
  const grouped = await prisma.elementSample.groupBy({
    by: ['elementSymbol'],
    where: { userId },
    _count: { _all: true },
  });
  const map = {};
  for (const g of grouped) map[g.elementSymbol] = g._count._all;
  return map;
}

/**
 * Validate + clean a single raw sample object.
 */
function sanitizeSample(raw, validFormatKeys) {
  const data = {};

  if (raw.acquisitionDate) {
    const d = new Date(raw.acquisitionDate);
    if (isNaN(d.getTime())) throw new Error('Invalid acquisition date');
    if (d.getTime() > Date.now() + 86400000) throw new Error('Acquisition date cannot be in the future');
    data.acquisitionDate = d;
  } else {
    data.acquisitionDate = null;
  }

  data.source = (raw.source || '').trim().slice(0, 200) || null;

  if (raw.pricePaid !== undefined && raw.pricePaid !== null && `${raw.pricePaid}`.trim() !== '') {
    const price = parseFloat(raw.pricePaid);
    if (isNaN(price) || price < 0 || price > 999999.99) {
      throw new Error('Price must be between 0 and 999,999.99');
    }
    data.pricePaid = Math.round(price * 100) / 100;
  } else {
    data.pricePaid = null;
  }

  data.currency = (raw.currency || 'USD').trim().toUpperCase().slice(0, 3) || 'USD';

  if (raw.condition && CONDITIONS.includes(raw.condition)) {
    data.condition = raw.condition;
  } else {
    data.condition = null;
  }

  // Accept any format key that is currently active in Admin → Formats.
  // (Previously a hardcoded whitelist silently dropped "Other", "Foil", etc.,
  // which is why those never carried through to the ledger.)
  if (raw.format && (!validFormatKeys || validFormatKeys.has(raw.format))) {
    data.format = raw.format;
  } else {
    data.format = null;
  }

  data.storageLocation = (raw.storageLocation || '').trim().slice(0, 200) || null;
  data.notes = (raw.notes || '').trim().slice(0, 2000) || null;

  return data;
}

/**
 * Determine whether a sanitized sample carries any meaningful data.
 */
function isEmptySample(s) {
  return (
    !s.acquisitionDate &&
    !s.source &&
    s.pricePaid == null &&
    !s.condition &&
    !s.format &&
    !s.storageLocation &&
    !s.notes
  );
}

/**
 * Replace ALL samples for an element with the supplied array.
 * Empty samples are skipped. Saving at least one sample marks the
 * element OWNED. Returns the resulting list of samples.
 *
 * @param {string} userId
 * @param {string} elementSymbol
 * @param {Array<object>} rawSamples
 */
export async function saveSamples(userId, elementSymbol, rawSamples) {
  const validFormatKeys = await getValidFormatKeys();
  const cleaned = (Array.isArray(rawSamples) ? rawSamples : [])
    .map((s) => sanitizeSample(s, validFormatKeys))
    .filter((s) => !isEmptySample(s));

  const item = await ensureCollectionItem(userId, elementSymbol, cleaned.length > 0);

  // Replace-all: delete existing, recreate from payload.
  await prisma.elementSample.deleteMany({
    where: { userId, elementSymbol },
  });

  if (cleaned.length > 0) {
    await prisma.elementSample.createMany({
      data: cleaned.map((s) => ({
        userId,
        collectionItemId: item.id,
        elementSymbol,
        ...s,
      })),
    });
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'note_saved',
      elementSymbol,
      details: JSON.stringify({ samples: cleaned.length }),
    },
  });

  return getSamples(userId, elementSymbol);
}

/**
 * Aggregate investment data across ALL samples for the dashboard.
 */
export async function getInvestmentSummaryFromSamples(userId) {
  const samples = await prisma.elementSample.findMany({
    where: { userId, pricePaid: { not: null } },
    orderBy: { pricePaid: 'desc' },
  });

  const totalInvested = samples.reduce((sum, s) => sum + (s.pricePaid || 0), 0);
  const itemsWithPrice = samples.length;
  const avgPrice = itemsWithPrice > 0 ? totalInvested / itemsWithPrice : 0;
  const mostExpensive = samples[0] || null;

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    itemsWithPrice,
    avgPrice: Math.round(avgPrice * 100) / 100,
    mostExpensive: mostExpensive
      ? { elementSymbol: mostExpensive.elementSymbol, pricePaid: mostExpensive.pricePaid }
      : null,
    currency: samples[0]?.currency || 'USD',
  };
}
