/**
 * Luciteria Collector Cabinet — Element Notes Service (Phase 2B)
 *
 * Structured, private provenance notes attached 1:1 to a CollectionItem.
 * Captures acquisition date, source, price paid, condition, storage
 * location and free-text notes. Also powers the dashboard "Total Invested"
 * card by aggregating pricePaid across a user's notes.
 */

import { prisma } from './db.server.js';
import { ELEMENTS_118 } from '../data/elements.server.js';

export const CONDITIONS = ['Mint', 'Excellent', 'Good', 'Fair', 'Damaged'];

/**
 * Ensure a CollectionItem exists for (user, element). Returns the item.
 * Notes can be attached to any tracked element (typically OWNED).
 */
async function ensureCollectionItem(userId, elementSymbol) {
  const element = ELEMENTS_118.find((el) => el.sym === elementSymbol);
  if (!element) throw new Error(`Unknown element: ${elementSymbol}`);

  return prisma.collectionItem.upsert({
    where: { userId_elementSymbol: { userId, elementSymbol } },
    update: {},
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
 * Get the note for a specific element (or null).
 */
export async function getNote(userId, elementSymbol) {
  return prisma.elementNote.findFirst({
    where: { userId, elementSymbol },
  });
}

/**
 * Get all notes for a user keyed by element symbol.
 */
export async function getNotesMap(userId) {
  const notes = await prisma.elementNote.findMany({ where: { userId } });
  const map = {};
  for (const n of notes) map[n.elementSymbol] = n;
  return map;
}

/**
 * Parse + validate raw form values into a clean note payload.
 * Throws an Error with a user-readable message on invalid input.
 */
function sanitizeInput(raw) {
  const data = {};

  if (raw.acquisitionDate) {
    const d = new Date(raw.acquisitionDate);
    if (isNaN(d.getTime())) throw new Error('Invalid acquisition date');
    if (d.getTime() > Date.now()) throw new Error('Acquisition date cannot be in the future');
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

  data.storageLocation = (raw.storageLocation || '').trim().slice(0, 200) || null;
  data.notes = (raw.notes || '').trim().slice(0, 2000) || null;
  data.isPrivate = raw.isPrivate === undefined ? true : !!raw.isPrivate;

  return data;
}

/**
 * Create or update a note for an element.
 */
export async function upsertNote(userId, elementSymbol, raw) {
  const data = sanitizeInput(raw);
  const item = await ensureCollectionItem(userId, elementSymbol);

  const existing = await prisma.elementNote.findUnique({
    where: { collectionItemId: item.id },
  });

  let note;
  if (existing) {
    note = await prisma.elementNote.update({
      where: { id: existing.id },
      data,
    });
  } else {
    note = await prisma.elementNote.create({
      data: {
        userId,
        collectionItemId: item.id,
        elementSymbol,
        ...data,
      },
    });
  }

  await prisma.activityLog.create({
    data: {
      userId,
      action: 'note_saved',
      elementSymbol,
      details: JSON.stringify({ hasPrice: data.pricePaid != null }),
    },
  });

  return note;
}

/**
 * Delete a note for an element.
 */
export async function deleteNote(userId, elementSymbol) {
  const note = await prisma.elementNote.findFirst({
    where: { userId, elementSymbol },
  });
  if (!note) return null;
  await prisma.elementNote.delete({ where: { id: note.id } });
  return note;
}

/**
 * Aggregate investment data for the dashboard "Total Invested" card.
 */
export async function getInvestmentSummary(userId) {
  const notes = await prisma.elementNote.findMany({
    where: { userId, pricePaid: { not: null } },
    orderBy: { pricePaid: 'desc' },
  });

  const totalInvested = notes.reduce((sum, n) => sum + (n.pricePaid || 0), 0);
  const itemsWithPrice = notes.length;
  const avgPrice = itemsWithPrice > 0 ? totalInvested / itemsWithPrice : 0;
  const mostExpensive = notes[0] || null;

  return {
    totalInvested: Math.round(totalInvested * 100) / 100,
    itemsWithPrice,
    avgPrice: Math.round(avgPrice * 100) / 100,
    mostExpensive: mostExpensive
      ? { elementSymbol: mostExpensive.elementSymbol, pricePaid: mostExpensive.pricePaid }
      : null,
    currency: notes[0]?.currency || 'USD',
  };
}
