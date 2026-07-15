/**
 * Ownership Tracking Service (Phase 2 — Built but Dormant)
 * 
 * Tracks per-user SKU ownership, maps SKUs to elements,
 * and calculates completion progress.
 * 
 * All functions check the phase2_ownership_tracking feature flag
 * and return empty/null results if disabled.
 */
import { prisma } from "./db.server.js";
import { isPhase2Enabled } from "./feature-flags.server.js";

// ─── SKU → Element mapping (simplified for prototype) ───────
// In production, this would come from the SKU_MAPPING_MASTER CSV
const SKU_ELEMENT_PATTERN = /^([A-Z][a-z]?)[\d_]/;

function extractElementFromSku(sku) {
  const match = sku.match(SKU_ELEMENT_PATTERN);
  return match ? match[1] : null;
}

function extractFormatFromSku(sku) {
  if (sku.includes("2x2")) return "lucite";
  if (sku.includes("10mm")) return "10mm";
  if (sku.includes("25mm")) return "25.4mm";
  if (sku.includes("50mm")) return "50mm";
  if (sku.includes("_amp")) return "ampoules";
  return null;
}

/**
 * Track a purchase/subscription delivery as owned SKU
 * Only creates record if phase2_ownership_tracking flag is true
 */
export async function trackPurchase(userId, sku, source = "PURCHASE") {
  if (!await isPhase2Enabled("ownership_tracking")) return null;

  const elementSymbol = extractElementFromSku(sku);
  const format = extractFormatFromSku(sku);

  try {
    const record = await prisma.userOwnedSku.upsert({
      where: { userId_sku: { userId, sku } },
      update: {},
      create: {
        userId,
        sku,
        elementSymbol,
        format,
        source,
      },
    });

    // Update completion goals if applicable
    await updateCompletionGoals(userId, format);

    return record;
  } catch (err) {
    console.error("[Ownership] Track purchase error:", err);
    return null;
  }
}

/**
 * Get all owned elements for a user
 */
export async function getUserOwnedElements(userId, format = null) {
  if (!await isPhase2Enabled("ownership_tracking")) return [];

  const where = { userId };
  if (format) where.format = format;

  return prisma.userOwnedSku.findMany({
    where,
    orderBy: { acquiredDate: "desc" },
  });
}

/**
 * Get completion progress for a user in a specific format
 */
export async function getCompletionProgress(userId, format) {
  if (!await isPhase2Enabled("completion_display")) return null;

  const ownedCount = await prisma.userOwnedSku.count({
    where: { userId, format },
  });

  // Total elements that are available in this format
  // 118 is the max for any format, but in practice many formats have fewer
  const TOTAL_ELEMENTS = 118;

  return {
    owned: ownedCount,
    total: TOTAL_ELEMENTS,
    percentage: Math.round((ownedCount / TOTAL_ELEMENTS) * 100),
    format,
  };
}

/**
 * Get all completion progress across all formats for a user
 */
export async function getAllCompletionProgress(userId) {
  if (!await isPhase2Enabled("completion_display")) return [];

  const formats = ["10mm", "25.4mm", "50mm", "lucite", "ampoules"];
  const results = [];

  for (const format of formats) {
    const progress = await getCompletionProgress(userId, format);
    if (progress) results.push(progress);
  }

  return results;
}

/**
 * Update completion goals after a new acquisition
 */
async function updateCompletionGoals(userId, format) {
  const goals = await prisma.completionGoal.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        { goalType: "FULL_SET" },
        { goalType: "FORMAT_SET", targetFormat: format },
      ],
    },
  });

  for (const goal of goals) {
    const count = await prisma.userOwnedSku.count({
      where: {
        userId,
        ...(goal.targetFormat ? { format: goal.targetFormat } : {}),
      },
    });

    await prisma.completionGoal.update({
      where: { id: goal.id },
      data: { currentCount: count },
    });
  }
}

/**
 * Get owned SKU symbols as a Set (for periodic table overlay)
 */
export async function getOwnedSymbols(userId) {
  if (!await isPhase2Enabled("ownership_tracking")) return new Set();

  const owned = await prisma.userOwnedSku.findMany({
    where: { userId },
    select: { elementSymbol: true },
  });

  return new Set(owned.map(o => o.elementSymbol).filter(Boolean));
}
