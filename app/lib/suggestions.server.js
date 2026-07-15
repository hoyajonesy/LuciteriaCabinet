/**
 * Suggestion Engine (Phase 2 — Built but Dormant)
 * 
 * Analyzes user's owned SKUs and suggests missing elements.
 * Display only — no auto-ship functionality.
 * 
 * Activates only when phase2_suggestions feature flag is true.
 */
import { prisma } from "./db.server.js";
import { isPhase2Enabled } from "./feature-flags.server.js";

/**
 * Get suggested missing elements for a user
 * Returns elements the user doesn't own that are available for their format
 */
export async function getSuggestedElements(userId, format, limit = 10) {
  if (!await isPhase2Enabled("suggestions")) return [];

  // Get user's owned SKUs
  const ownedSkus = await prisma.userOwnedSku.findMany({
    where: { userId, format },
    select: { sku: true, elementSymbol: true },
  });

  const ownedSymbols = new Set(ownedSkus.map(o => o.elementSymbol).filter(Boolean));

  // Get all eligible subscription SKUs in this format
  const eligibleSkus = await prisma.subscriptionSku.findMany({
    where: { isEligible: true },
  });

  // Cross-reference with Product catalog to find available items
  const eligibleSkuStrings = eligibleSkus.map(s => s.sku);
  const availableProducts = await prisma.product.findMany({
    where: {
      sku: { in: eligibleSkuStrings },
      status: "Active",
      inventoryQty: { gt: 0 },
    },
    orderBy: { priceUsd: "asc" },
  });

  // Filter to missing elements
  const suggestions = availableProducts
    .filter(p => !ownedSymbols.has(p.elementSymbol))
    .slice(0, limit)
    .map(p => ({
      sku: p.sku,
      elementSymbol: p.elementSymbol,
      elementName: p.elementName,
      format: p.format,
      price: p.priceUsd,
      retailPrice: p.retailPrice,
      category: p.category,
      rarityTier: p.rarityTier,
      inStock: p.inventoryQty > 0,
    }));

  return suggestions;
}

/**
 * Get a summary of what's missing across all formats
 */
export async function getMissingSummary(userId) {
  if (!await isPhase2Enabled("suggestions")) return null;

  const formats = ["10mm", "25.4mm", "50mm", "lucite", "ampoules"];
  const summary = {};

  for (const format of formats) {
    const owned = await prisma.userOwnedSku.count({
      where: { userId, format },
    });
    summary[format] = {
      owned,
      total: 118,
      missing: 118 - owned,
    };
  }

  return summary;
}

/**
 * Get priority suggestions based on user's wishlist overlap
 */
export async function getPrioritySuggestions(userId, format, limit = 5) {
  if (!await isPhase2Enabled("suggestions")) return [];

  // Get user's wishlist elements
  const wishlist = await prisma.userWishlistElement.findMany({
    where: { userId },
    select: { elementSymbol: true },
    orderBy: { priority: "asc" },
  });

  const wishlistSymbols = new Set(wishlist.map(w => w.elementSymbol));

  // Get general suggestions
  const allSuggestions = await getSuggestedElements(userId, format, 50);

  // Prioritize wishlist items
  const prioritized = allSuggestions
    .sort((a, b) => {
      const aWish = wishlistSymbols.has(a.elementSymbol) ? 0 : 1;
      const bWish = wishlistSymbols.has(b.elementSymbol) ? 0 : 1;
      return aWish - bWish;
    })
    .slice(0, limit);

  return prioritized.map(s => ({
    ...s,
    isWishlisted: wishlistSymbols.has(s.elementSymbol),
  }));
}
