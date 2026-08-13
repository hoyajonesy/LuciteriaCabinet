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

  if (existing) {
    // Only update if this is the same onboarding session (same contract) or a staff override
    const canUpdate = 
      existing.sourceSubscriptionContractId === contractId ||
      source === OWNERSHIP_SOURCE.STAFF_ENTERED;

    if (canUpdate) {
      return prisma.collectionItem.update({
        where: { id: existing.id },
        data: {
          state,
          ownershipSource: source,
          subscriberConfirmed,
          rejectedBySubscriber: false, // Clear rejection if re-confirming
          recordedAt: new Date(),
          // Record the format track this ownership was confirmed against
          // (only overwrite when a format is supplied).
          ...(normalizedFormat ? { format: normalizedFormat } : {}),
        },
      });
    } else {
      // FR-5: Don't modify records from other sessions
      return existing;
    }
  }

  // Create new record with full provenance
  return prisma.collectionItem.create({
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

/**
 * FR-4: Record an explicit rejection (user declined a suggested item during onboarding).
 * A rejected item MUST NOT be re-trusted by any part of the system, including BACKSTOP_ONLY.
 */
export async function recordRejection(userId, elementSymbol, format, contractId) {
  const canonical = resolveCanonicalElement(elementSymbol);
  if (!canonical) {
    throw new Error(`Unknown element: ${elementSymbol}`);
  }

  const normalizedFormat = format ? normaliseFormat(format) : null;

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
 */
export async function isRejected(userId, elementSymbol, format) {
  const canonical = resolveCanonicalElement(elementSymbol);
  if (!canonical) return false;

  const item = await prisma.collectionItem.findFirst({
    where: {
      userId,
      elementSymbol: canonical.sym,
      rejectedBySubscriber: true,
    },
  });

  return Boolean(item);
}
