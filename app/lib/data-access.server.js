/**
 * Luciteria Collector Cabinet — Data Access Layer
 * 
 * All database queries centralized here for clean route handlers.
 * Each function returns shaped data ready for UI consumption.
 */
import { prisma } from "./db.server.js";

// ─── Customer Queries ───────────────────────────────────────

/** Get full customer profile with all related data */
async function getCustomerProfile(customerId) {
  return prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      collectionRecords: { include: { product: true } },
      wishlistItems: { include: { product: true }, orderBy: { priority: "asc" } },
      subscription: true,
      preferences: true,
      shipments: {
        include: { items: { include: { product: true } } },
        orderBy: { shipmentDate: "desc" },
      },
      exceptions: { orderBy: { createdAt: "desc" } },
      adminNotes: { orderBy: { createdAt: "desc" } },
    },
  });
}

/** Get customer by shopifyId */
async function getCustomerByShopifyId(shopifyId) {
  return prisma.customer.findUnique({
    where: { shopifyId },
    include: {
      collectionRecords: { include: { product: true } },
      wishlistItems: { include: { product: true }, orderBy: { priority: "asc" } },
      subscription: true,
      preferences: true,
    },
  });
}

/** List all customers with summary stats */
async function listCustomersWithStats() {
  const customers = await prisma.customer.findMany({
    include: {
      collectionRecords: true,
      wishlistItems: true,
      subscription: true,
      preferences: true,
      exceptions: { where: { status: "pending" } },
    },
    orderBy: { lastName: "asc" },
  });

  const totalProducts = await prisma.product.count({ where: { status: "Active" } });

  return customers.map((c) => ({
    ...c,
    stats: {
      totalCollected: c.collectionRecords.length,
      totalProducts,
      completionPct: Math.round((c.collectionRecords.length / totalProducts) * 100),
      wishlistCount: c.wishlistItems.length,
      pendingExceptions: c.exceptions.length,
      subscriptionStatus: c.subscription?.status || "none",
    },
  }));
}

// ─── Product Queries ────────────────────────────────────────

/** Get all products with optional filters */
async function getProducts({ category, format, status, inStock } = {}) {
  const where = {};
  if (category) where.category = category;
  if (format) where.format = format;
  if (status) where.status = status;
  if (inStock) where.inventoryQty = { gt: 0 };
  
  return prisma.product.findMany({
    where,
    orderBy: { atomicNumber: "asc" },
  });
}

/** Get product with full details */
async function getProduct(productId) {
  return prisma.product.findUnique({
    where: { id: productId },
    include: {
      collectionRecords: { include: { customer: true } },
      wishlistItems: { include: { customer: true } },
      inventoryLog: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
}

// ─── Collection Queries ─────────────────────────────────────

/** Get customer's collection with product details */
async function getCustomerCollection(customerId) {
  return prisma.collectionRecord.findMany({
    where: { customerId },
    include: { product: true },
    orderBy: { product: { atomicNumber: "asc" } },
  });
}

/** Get products the customer does NOT own */
async function getMissingProducts(customerId) {
  const owned = await prisma.collectionRecord.findMany({
    where: { customerId },
    select: { productId: true },
  });
  const ownedIds = owned.map((r) => r.productId);

  return prisma.product.findMany({
    where: {
      id: { notIn: ownedIds },
      status: "Active",
    },
    orderBy: { atomicNumber: "asc" },
  });
}

// ─── Wishlist Queries ───────────────────────────────────────

async function getWishlist(customerId) {
  return prisma.wishlistItem.findMany({
    where: { customerId },
    include: { product: true },
    orderBy: { priority: "asc" },
  });
}

async function addToWishlist(customerId, productId) {
  const maxPriority = await prisma.wishlistItem.findFirst({
    where: { customerId },
    orderBy: { priority: "desc" },
    select: { priority: true },
  });
  
  return prisma.wishlistItem.upsert({
    where: { customerId_productId: { customerId, productId } },
    update: {},
    create: {
      customerId,
      productId,
      priority: (maxPriority?.priority || 0) + 1,
    },
  });
}

async function removeFromWishlist(customerId, productId) {
  return prisma.wishlistItem.delete({
    where: { customerId_productId: { customerId, productId } },
  });
}

// ─── Subscription Queries ───────────────────────────────────

async function getSubscription(customerId) {
  return prisma.subscription.findUnique({
    where: { customerId },
    include: {
      shipments: {
        include: { items: { include: { product: true } } },
        orderBy: { shipmentDate: "desc" },
      },
    },
  });
}

// ─── Preferences Queries ────────────────────────────────────

async function getPreferences(customerId) {
  return prisma.customerPreference.findUnique({
    where: { customerId },
  });
}

async function updatePreferences(customerId, data) {
  return prisma.customerPreference.upsert({
    where: { customerId },
    update: data,
    create: { customerId, ...data },
  });
}

// ─── Admin Queries ──────────────────────────────────────────

/** Get all pending assignment exceptions */
async function getPendingExceptions() {
  return prisma.assignmentException.findMany({
    where: { status: "pending" },
    include: { customer: true },
    orderBy: { createdAt: "asc" },
  });
}

/** Get upcoming subscription assignments (next 30 days) */
async function getUpcomingAssignments() {
  const thirtyDaysOut = new Date();
  thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

  return prisma.subscription.findMany({
    where: {
      status: "active",
      nextShipmentDate: { lte: thirtyDaysOut },
    },
    include: {
      customer: {
        include: {
          collectionRecords: true,
          preferences: true,
          wishlistItems: true,
        },
      },
    },
    orderBy: { nextShipmentDate: "asc" },
  });
}

/** Dashboard stats */
async function getAdminDashboardStats() {
  const [
    totalCustomers,
    activeSubscriptions,
    pendingExceptions,
    totalProducts,
    inStockProducts,
    totalShipments,
  ] = await Promise.all([
    prisma.customer.count(),
    prisma.subscription.count({ where: { status: "active" } }),
    prisma.assignmentException.count({ where: { status: "pending" } }),
    prisma.product.count({ where: { status: "Active" } }),
    prisma.product.count({ where: { status: "Active", inventoryQty: { gt: 0 } } }),
    prisma.subscriptionShipment.count(),
  ]);

  return {
    totalCustomers,
    activeSubscriptions,
    pendingExceptions,
    totalProducts,
    inStockProducts,
    outOfStockProducts: totalProducts - inStockProducts,
    totalShipments,
  };
}

export {
  getCustomerProfile,
  getCustomerByShopifyId,
  listCustomersWithStats,
  getProducts,
  getProduct,
  getCustomerCollection,
  getMissingProducts,
  getWishlist,
  addToWishlist,
  removeFromWishlist,
  getSubscription,
  getPreferences,
  updatePreferences,
  getPendingExceptions,
  getUpcomingAssignments,
  getAdminDashboardStats,
};
