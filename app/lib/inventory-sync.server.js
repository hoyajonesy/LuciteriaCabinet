/**
 * Inventory Sync Hooks
 * 
 * Bridges between SKU/inventory data and the subscription system.
 * In production, these would be triggered by Shopify webhooks.
 * 
 * TODO PRODUCTION: Connect to Shopify Inventory API
 *   - products/update webhook → syncSkuAvailability
 *   - inventory_levels/update webhook → updateStockCount
 */
import { prisma } from "./db.server.js";

/**
 * Sync SKU availability from inventory update
 * Called when stock levels change (webhook or manual)
 */
export async function syncSkuAvailability(sku, stockCount) {
  // Update product inventory
  const product = await prisma.product.findUnique({ where: { sku } });
  if (!product) {
    console.warn(`[Inventory] SKU not found: ${sku}`);
    return null;
  }

  const prevQty = product.inventoryQty;

  await prisma.$transaction([
    prisma.product.update({
      where: { sku },
      data: { inventoryQty: stockCount },
    }),
    prisma.inventoryLog.create({
      data: {
        productId: product.id,
        prevQty,
        newQty: stockCount,
        reason: "shopify_sync",
        source: "shopify_webhook",
      },
    }),
  ]);

  // If stock dropped to 0, check if this affects any active packs
  if (stockCount === 0) {
    await flagOutOfStockPacks(sku);
  }

  return { sku, prevQty, newQty: stockCount };
}

/**
 * Check if all SKUs in a pack are in stock
 */
export async function checkPackAvailability(packId) {
  const pack = await prisma.collectorPack.findUnique({ where: { id: packId } });
  if (!pack) return { available: false, error: "Pack not found" };

  const skuList = JSON.parse(pack.skuList || "[]");
  if (skuList.length === 0) return { available: false, error: "Pack has no SKUs" };

  const products = await prisma.product.findMany({
    where: { sku: { in: skuList } },
    select: { sku: true, inventoryQty: true, status: true },
  });

  const outOfStock = products.filter(p => p.inventoryQty <= 0 || p.status !== "Active");
  const missingSkus = skuList.filter(sku => !products.find(p => p.sku === sku));

  return {
    available: outOfStock.length === 0 && missingSkus.length === 0,
    totalSkus: skuList.length,
    inStockCount: products.filter(p => p.inventoryQty > 0).length,
    outOfStock: outOfStock.map(p => p.sku),
    missingSkus,
  };
}

/**
 * Reserve pack inventory when an order is approved
 * Decrements stock for each SKU in the pack
 */
export async function reservePackInventory(packId, quantity = 1) {
  const pack = await prisma.collectorPack.findUnique({ where: { id: packId } });
  if (!pack) throw new Error("Pack not found");

  const skuList = JSON.parse(pack.skuList || "[]");

  // Verify all SKUs have sufficient stock
  for (const sku of skuList) {
    const product = await prisma.product.findUnique({ where: { sku } });
    if (!product || product.inventoryQty < quantity) {
      throw new Error(`Insufficient stock for SKU: ${sku} (available: ${product?.inventoryQty ?? 0}, needed: ${quantity})`);
    }
  }

  // Reserve stock in a transaction
  const operations = [];
  for (const sku of skuList) {
    const product = await prisma.product.findUnique({ where: { sku } });
    operations.push(
      prisma.product.update({
        where: { sku },
        data: { inventoryQty: { decrement: quantity } },
      }),
      prisma.inventoryLog.create({
        data: {
          productId: product.id,
          prevQty: product.inventoryQty,
          newQty: product.inventoryQty - quantity,
          reason: "shipment",
          source: "assignment_engine",
        },
      })
    );
  }

  await prisma.$transaction(operations);
  return { packId, skusReserved: skuList.length, quantity };
}

/**
 * Flag packs containing out-of-stock SKUs
 */
async function flagOutOfStockPacks(sku) {
  const packs = await prisma.collectorPack.findMany({
    where: { isActive: true },
  });

  for (const pack of packs) {
    const skuList = JSON.parse(pack.skuList || "[]");
    if (skuList.includes(sku)) {
      console.warn(`[Inventory] Pack "${pack.name}" (${pack.id}) contains out-of-stock SKU: ${sku}`);
      // In production: create admin alert / notification
    }
  }
}

/**
 * Get inventory status summary for admin dashboard
 */
export async function getInventorySummary() {
  const products = await prisma.product.findMany({
    where: { status: "Active" },
    select: { sku: true, inventoryQty: true, elementName: true },
  });

  return {
    totalProducts: products.length,
    inStock: products.filter(p => p.inventoryQty > 0).length,
    outOfStock: products.filter(p => p.inventoryQty <= 0).length,
    lowStock: products.filter(p => p.inventoryQty > 0 && p.inventoryQty <= 3).length,
    outOfStockItems: products.filter(p => p.inventoryQty <= 0).map(p => ({ sku: p.sku, name: p.elementName })),
  };
}
