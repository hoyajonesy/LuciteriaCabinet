/**
 * Ownership Provenance — Subscription Onboarding
 * 
 * Implements FR-1, FR-3, FR-4, FR-5 from LuciteriaCabinet_Subscription_Onboarding_FRD_v1.2:
 * - FR-1: Normalized ownable-unit identity (element + canonical format)
 * - FR-3: Full provenance tracking (source, recordedAt, subscriberConfirmed, contract)
 * - FR-4: Explicit rejection tracking (rejectedBySubscriber flag)
 * - FR-5: Add/confirm-only writes (never delete records from other sessions)
 */

import { prisma } from "./db.server.js";
import { normaliseFormat } from "./formats.js";
import { CANONICAL_ELEMENTS } from "../data/periodic-canonical.js";

/**
 * Ownership source enum values (FR-3)
 */
export const OWNERSHIP_SOURCE = {
  SHOPIFY_ORDER_SUGGESTED: "SHOPIFY_ORDER_SUGGESTED",
  ONBOARDING_CONFIRMED: "ONBOARDING_CONFIRMED",
  MANUAL_CABINET_ENTRY: "MANUAL_CABINET_ENTRY",
  PASSPORT_FLOW: "PASSPORT_FLOW",
  STAFF_ENTERED: "STAFF_ENTERED",
};

/**
 * Rejection reason enum values (v1.3 §4.3).
 */
export const REJECTION_REASON = {
  ONBOARDING_DECLINED: "ONBOARDING_DECLINED",
  GIFT: "GIFT",
  NO_LONGER_OWNED: "NO_LONGER_OWNED",
  OTHER: "OTHER",
};

/**
 * FR-1/FR-2: build the single normalized "ownable unit" identity used
 * consistently across order-history seeding, Cabinet owned-items, Passport, and
 * Assignment Engine exclusion matching. Element symbol is lower-cased and the
 * physical format is canonicalised so "Fe" + "10mm" and "fe" + "10mm_cube"
 * resolve to the same identity ("fe|10mm_cube"). A null format is represented
 * explicitly as "null" so it can never collide with a real format.
 *
 * @param {string} elementSymbol
 * @param {string|null} format
 * @returns {string} ownableUnitId (e.g. "fe|10mm_cube")
 */
export function ownableUnitId(elementSymbol, format) {
  const sym = String(elementSymbol || "").toLowerCase();
  const fmt = format ? normaliseFormat(format) : null;
  return `${sym}|${fmt || "null"}`;
}

/**
 * FR-1: Resolve element symbol and atomic number from CANONICAL_ELEMENTS
 */
function resolveCanonicalElement(elementSymbol) {
  const canonical = CANONICAL_ELEMENTS.find(
    (e) => e.sym.toLowerCase() === (elementSymbol || "").toLowerCase()
  );
  return canonical || null;
}

/**
 * FR-3: Record or update ownership with full provenance.
 * This is the ONLY function that should write CollectionItem records for onboarding.
 * 
 * @param {string} userId - User ID
 * @param {string} elementSymbol - Element symbol (e.g. "Fe")
 * @param {string|null} format - Canonical format id (e.g. "10mm_cube") or null
 * @param {object} options - { source, subscriberConfirmed, contractId, state }
 * @returns {Promise<CollectionItem>}
 */
export async function recordOwnership(userId, elementSymbol, format, options = {}) {
  const canonical = resolveCanonicalElement(elementSymbol);
  if (!canonical) {
    throw new Error(`Unknown element: ${elementSymbol}`);
  }

  const normalizedFormat = format ? normaliseFormat(format) : null;
  const {
    source = OWNERSHIP_SOURCE.MANUAL_CABINET_ENTRY,
    subscriberConfirmed = false,
    contractId = null,
    state = "OWNED",
  } = options;

  // FR-5: Upsert with add/confirm-only semantics.
  // CollectionItem is keyed one-row-per-element (userId, elementSymbol); the
  // format is stored as an attribute on that row.
  const existing = await prisma.collectionItem.findFirst({
    where: {
      userId,
      elementSymbol: canonical.sym,
    },
  });

  let record;
  if (existing) {
    // Only update if this is the same onboarding session (same contract) or a staff override
    const canUpdate = 
      existing.sourceSubscriptionContractId === contractId ||
      source === OWNERSHIP_SOURCE.STAFF_ENTERED;

    if (canUpdate) {
      // FR-1/FR-2: the CollectionItem row is a per-element ANCHOR and holds only
      // the PRIMARY format. A subscriber may own the same element in several
      // formats (the FRD's 10mm-vs-25.4mm cube example). We must NOT overwrite a
      // previously recorded primary format with a newly confirmed one — doing so
      // silently discards the first format's ownership. Only set the primary
      // when the row does not yet have one; every confirmed format (primary or
      // additional) is persisted as an ElementSample child below so all formats
      // survive and are seen by the exclusion engine.
      const setPrimaryFormat = normalizedFormat && !existing.format;
      record = await prisma.collectionItem.update({
        where: { id: existing.id },
        data: {
          state,
          ownershipSource: source,
          subscriberConfirmed,
          rejectedBySubscriber: false, // Clear rejection if re-confirming
          recordedAt: new Date(),
          ...(setPrimaryFormat ? { format: normalizedFormat } : {}),
        },
      });
    } else {
      // FR-5: Don't modify records from other sessions
      record = existing;
    }
  } else {
    // Create new record with full provenance
    record = await prisma.collectionItem.create({
      data: {
        userId,
        elementSymbol: canonical.sym,
        elementName: canonical.name,
        atomicNumber: canonical.z,
        format: normalizedFormat,
        state,
        ownershipSource: source,
        recordedAt: new Date(),
        subscriberConfirmed,
        sourceSubscriptionContractId: contractId,
        rejectedBySubscriber: false,
      },
    });
  }

  // FR-1/FR-2: persist THIS confirmed format as an ElementSample child of the
  // per-element CollectionItem anchor. This is the fix for the write-path
  // data-loss bug: because the CollectionItem row can only carry one primary
  // format, additional formats of the same element would otherwise be lost. By
  // recording every OWNED confirmation (primary AND additional) as a distinct
  // sample, the exclusion engine — which unions CollectionItem.format with all
  // ElementSample formats — correctly treats each (element, format) as its own
  // ownable unit. Idempotent: at most one sample per (userId, collectionItem,
  // format). Best-effort — never fail a confirm on sample bookkeeping.
  if (state === "OWNED" && normalizedFormat) {
    try {
      await ensureElementSample(userId, record.id, canonical.sym, normalizedFormat, source);
    } catch (e) {
      /* non-fatal: primary format on the CollectionItem still covers this unit */
    }
  }

  // FR-6: if the subscriber is confirming ownership of a unit that was
  // previously rejected, supersede the active rejection rather than leaving two
  // contradictory active records. Best-effort — never fail a confirm on this.
  if (state === "OWNED") {
    try {
      await supersedeActiveRejections(
        userId,
        ownableUnitId(canonical.sym, normalizedFormat),
        `collectionItem:${record.id}`
      );
    } catch {
      /* non-fatal: exclusion logic also intersects OWNED with active rejections */
    }
  }

  return record;
}

/**
 * FR-1/FR-2: ensure a single ElementSample exists for a confirmed
 * (userId, collectionItemId, canonical format). Idempotent — re-confirming the
 * same format is a no-op. This is what lets a subscriber own the same element
 * in multiple physical formats (10mm cube AND 25.4mm cube) as distinct ownable
 * units without one confirmation overwriting another.
 *
 * @param {string} userId
 * @param {string} collectionItemId
 * @param {string} elementSymbol - canonical symbol
 * @param {string} normalizedFormat - canonical format id (e.g. "10mm_cube")
 * @param {string} [source] - ownership source enum value
 * @returns {Promise<Object|null>} the existing or created ElementSample
 */
export async function ensureElementSample(userId, collectionItemId, elementSymbol, normalizedFormat, source = null) {
  if (!normalizedFormat) return null;
  const existingSample = await prisma.elementSample.findFirst({
    where: { userId, collectionItemId, format: normalizedFormat },
  });
  if (existingSample) return existingSample;
  return prisma.elementSample.create({
    data: {
      userId,
      collectionItemId,
      elementSymbol,
      format: normalizedFormat,
      source: source || null,
    },
  });
}

/**
 * FR-6: mark any ACTIVE rejection for (userId, ownableUnitId) as superseded.
 * @returns {Promise<number>} number of rejections superseded
 */
export async function supersedeActiveRejections(userId, ouid, supersededBy) {
  const res = await prisma.ownershipRejection.updateMany({
    where: { userId, ownableUnitId: ouid, supersededAt: null },
    data: { supersededAt: new Date(), supersededBy: supersededBy || "confirmed" },
  });
  return res.count;
}

/**
 * FR-4: Record an explicit rejection (user declined a suggested item during onboarding).
 * A rejected item MUST NOT be re-trusted by any part of the system, including BACKSTOP_ONLY.
 */
export async function recordRejection(userId, elementSymbol, format, contractId, reason = REJECTION_REASON.ONBOARDING_DECLINED) {
  const canonical = resolveCanonicalElement(elementSymbol);
  if (!canonical) {
    throw new Error(`Unknown element: ${elementSymbol}`);
  }

  const normalizedFormat = format ? normaliseFormat(format) : null;

  // v1.3 §4.3 / FR-6: the rejection's source of truth is a dedicated
  // OwnershipRejection row. Idempotent — if an ACTIVE rejection already exists
  // for this (userId, ownableUnitId) we leave it in place (the DB partial
  // unique index enforces at most one active row per unit).
  const ouid = ownableUnitId(canonical.sym, normalizedFormat);
  const activeRejection = await prisma.ownershipRejection.findFirst({
    where: { userId, ownableUnitId: ouid, supersededAt: null },
  });
  if (!activeRejection) {
    await prisma.ownershipRejection.create({
      data: {
        userId,
        ownableUnitId: ouid,
        reason,
        sourceSubscriptionContractId: contractId || null,
        recordedAt: new Date(),
        supersededAt: null,
        supersededBy: null,
      },
    });
  }

  // Check if there's already a record (one row per element).
  const existing = await prisma.collectionItem.findFirst({
    where: {
      userId,
      elementSymbol: canonical.sym,
    },
  });

  if (existing) {
    // Mark as rejected, clear owned/confirmed flags
    return prisma.collectionItem.update({
      where: { id: existing.id },
      data: {
        rejectedBySubscriber: true,
        state: "MISSING",
        subscriberConfirmed: false,
        ownershipSource: OWNERSHIP_SOURCE.ONBOARDING_CONFIRMED,
        sourceSubscriptionContractId: contractId,
        recordedAt: new Date(),
        ...(normalizedFormat ? { format: normalizedFormat } : {}),
      },
    });
  }

  // Create a new rejection record
  return prisma.collectionItem.create({
    data: {
      userId,
      elementSymbol: canonical.sym,
      elementName: canonical.name,
      atomicNumber: canonical.z,
      format: normalizedFormat,
      state: "MISSING",
      ownershipSource: OWNERSHIP_SOURCE.ONBOARDING_CONFIRMED,
      recordedAt: new Date(),
      subscriberConfirmed: false,
      sourceSubscriptionContractId: contractId,
      rejectedBySubscriber: true, // FR-4: Explicit rejection
    },
  });
}

/**
 * Query owned items for a user in a specific format track, excluding rejections (FR-4).
 * Used by the Assignment Engine for exclusion logic.
 */
export async function getOwnedItemsForFormat(userId, formatTrack) {
  const normalizedFormat = normaliseFormat(formatTrack);
  
  return prisma.collectionItem.findMany({
    where: {
      userId,
      format: normalizedFormat,
      state: "OWNED",
      rejectedBySubscriber: false, // FR-4: Never treat rejections as owned
    },
    select: {
      elementSymbol: true,
      atomicNumber: true,
      format: true,
      ownershipSource: true,
      subscriberConfirmed: true,
      recordedAt: true,
    },
  });
}

/**
 * Query ALL rejections for a user (any format), to ensure BACKSTOP_ONLY doesn't re-trust them.
 */
export async function getRejectedItems(userId) {
  return prisma.collectionItem.findMany({
    where: {
      userId,
      rejectedBySubscriber: true,
    },
    select: {
      elementSymbol: true,
      format: true,
    },
  });
}

/**
 * Check if a specific element+format was explicitly rejected by the user.
 * Sources the answer from the dedicated OwnershipRejection model (FR-6),
 * considering only ACTIVE (non-superseded) rejections.
 */
export async function isRejected(userId, elementSymbol, format) {
  const canonical = resolveCanonicalElement(elementSymbol);
  if (!canonical) return false;

  const normalizedFormat = format ? normaliseFormat(format) : null;
  const ouid = ownableUnitId(canonical.sym, normalizedFormat);
  const active = await prisma.ownershipRejection.findFirst({
    where: { userId, ownableUnitId: ouid, supersededAt: null },
  });
  return Boolean(active);
}

/**
 * FR-4/FR-6: return the set of ACTIVE ownableUnitId strings the user has
 * rejected (supersededAt IS NULL). Used by the Assignment Engine exclusion
 * logic so a rejected unit is never re-trusted as owned, including under the
 * BACKSTOP_ONLY fallback.
 *
 * @param {string} userId
 * @returns {Promise<Set<string>>} set of active ownableUnitId values
 */
export async function getActiveRejections(userId) {
  if (!userId) return new Set();
  const rows = await prisma.ownershipRejection.findMany({
    where: { userId, supersededAt: null },
    select: { ownableUnitId: true },
  });
  return new Set(rows.map((r) => r.ownableUnitId));
}
