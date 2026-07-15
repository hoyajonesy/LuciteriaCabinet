/**
 * Curation System (Phase 3 — Scaffold Only)
 * 
 * Stub functions for dynamic curation logic.
 * All functions throw "Phase 3 not activated" errors.
 * These hooks exist so the codebase is ready when Phase 3 launches.
 * 
 * Phase 3 will allow:
 *   - "Send me N missing elements per quarter" request type
 *   - Admin approval step before fulfillment
 *   - Restricted to fixed cadence, fixed box size, controlled SKU pool
 */
import { isPhase3Enabled } from "./feature-flags.server.js";

/**
 * Create a curation request (user-facing)
 * @throws Always — Phase 3 not activated
 */
export async function createCurationRequest(userId, params) {
  const enabled = await isPhase3Enabled();
  if (!enabled) {
    throw new Error("Phase 3 not activated — Custom curation is coming soon.");
  }

  // TODO Phase 3: Implement
  // - Validate params (requestType, elementCount, cadence)
  // - Check user has active subscription
  // - Create CurationRequest record
  // - Notify admin of new request
  throw new Error("Phase 3 not activated");
}

/**
 * Approve a curation request (admin-facing)
 * @throws Always — Phase 3 not activated
 */
export async function approveCurationRequest(requestId, adminId) {
  const enabled = await isPhase3Enabled();
  if (!enabled) {
    throw new Error("Phase 3 not activated — Custom curation is coming soon.");
  }

  // TODO Phase 3: Implement
  // - Update CurationRequest status to APPROVED
  // - Set approvedBy, approvedAt
  // - Trigger generateCuratedBox
  throw new Error("Phase 3 not activated");
}

/**
 * Generate a curated box based on approved request
 * @throws Always — Phase 3 not activated
 */
export async function generateCuratedBox(requestId) {
  const enabled = await isPhase3Enabled();
  if (!enabled) {
    throw new Error("Phase 3 not activated — Custom curation is coming soon.");
  }

  // TODO Phase 3: Implement
  // - Get CurationRequest + user ownership data
  // - Filter SKU pool by eligibility + inventory
  // - Exclude already-owned elements
  // - Select N elements matching request constraints
  // - Create CollectorPack with selected SKUs
  // - Create PackOrder for admin fulfillment
  throw new Error("Phase 3 not activated");
}

/**
 * Get curation request status (user or admin)
 * @throws Always — Phase 3 not activated
 */
export async function getCurationRequestStatus(requestId) {
  const enabled = await isPhase3Enabled();
  if (!enabled) {
    throw new Error("Phase 3 not activated");
  }

  // TODO Phase 3: Implement
  throw new Error("Phase 3 not activated");
}

/**
 * Get pending curation requests for admin queue
 * @throws Always — Phase 3 not activated
 */
export async function getPendingCurationRequests() {
  const enabled = await isPhase3Enabled();
  if (!enabled) {
    throw new Error("Phase 3 not activated");
  }

  // TODO Phase 3: Implement
  throw new Error("Phase 3 not activated");
}
