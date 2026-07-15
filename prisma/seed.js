/**
 * Luciteria Collector Cabinet — Seed Data (Phase 2)
 * 
 * Creates realistic mock data including:
 * - 35 collectible products with collection type tags
 * - 6 customer profiles with varying collection types
 * - Subscription histories with discount tracking
 * - Grandfathering and pricing scenarios
 * - Edge cases for testing assignment logic
 * 
 * NOTE: This seed script requires Prisma and a database.
 * The dev server uses in-memory mock-db.server.js instead.
 */

import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

// ─── Collection Types ────────────────────────────────────────
const COLLECTION_TYPES = ["10mm", "25.4mm", "50mm", "lucite", "ampoules"];

// ─── Products (expanded for Phase 2 with collection types) ───
const PRODUCTS = [
  // Lucite Cubes (50mm)
  { shopifyProductId: "10547105366181", shopifyVariantId: "47746564587685", handle: "strontium-2-lucite-cube", title: "Strontium 50mm Lucite Cube", sku: "Sr2x2", symbol: "Sr", name: "Strontium", number: 38, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 4, priceUsd: 89.99, retailPrice: 89.99, subscriptionCost: 69.99, rarityTier: "uncommon", description: "Rarely seen metal preserved in argon." },
  { shopifyProductId: "10547105431717", shopifyVariantId: "47746564653221", handle: "sodium-cube", title: "Sodium 50mm Lucite Cube", sku: "Na2x2", symbol: "Na", name: "Sodium", number: 11, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 8, priceUsd: 69.99, retailPrice: 69.99, subscriptionCost: 54.99, rarityTier: "common", description: "Gleaming mirror-like metal preserved in Lucite." },
  { shopifyProductId: "10547105628325", shopifyVariantId: "47746564849829", handle: "cerium-2-lucite-cube", title: "Cerium 50mm Lucite Cube", sku: "Ce2x2", symbol: "Ce", name: "Cerium", number: 58, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 7, priceUsd: 74.99, retailPrice: 74.99, subscriptionCost: 59.99, rarityTier: "common", description: "Argon-preserved cerium in its unoxidized glory." },
  { shopifyProductId: "10547105693861", shopifyVariantId: "47746564915365", handle: "chromium-2-lucite-cube", title: "Chromium 50mm Lucite Cube", sku: "Cr2x2", symbol: "Cr", name: "Chromium", number: 24, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 4, priceUsd: 79.99, retailPrice: 79.99, subscriptionCost: 62.99, rarityTier: "common", description: "Mirror-bright chromium in Lucite." },
  { shopifyProductId: "10547106021541", shopifyVariantId: "47746565308581", handle: "antimony-2-lucite-cube", title: "Antimony 50mm Lucite Cube", sku: "Sb2x2", symbol: "Sb", name: "Antimony", number: 51, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 5, priceUsd: 84.99, retailPrice: 84.99, subscriptionCost: 66.99, rarityTier: "uncommon", description: "Crystalline antimony catching light." },
  { shopifyProductId: "10547106054309", shopifyVariantId: "47746565341349", handle: "chlorine-liquid-50mm", title: "Chlorine (liquid) 50mm Lucite Cube", sku: "Cl2x2_liq", symbol: "Cl", name: "Chlorine", number: 17, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 4, priceUsd: 119.99, retailPrice: 119.99, subscriptionCost: 89.99, rarityTier: "rare", description: "Liquid chlorine in sealed ampule." },
  { shopifyProductId: "10547106087077", shopifyVariantId: "47746565374117", handle: "sulfur-2-lucite-cube", title: "Sulfur 50mm Lucite Cube", sku: "S2x2", symbol: "S", name: "Sulfur", number: 16, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 7, priceUsd: 64.99, retailPrice: 64.99, subscriptionCost: 49.99, rarityTier: "common", description: "Yellow sulfur crystals in Lucite." },
  { shopifyProductId: "10547106119845", shopifyVariantId: "47746565406885", handle: "tennessine-film-cube", title: "Tennessine 50mm Lucite Cube", sku: "Ts2x2_film", symbol: "Ts", name: "Tennessine", number: 117, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 3, priceUsd: 49.99, retailPrice: 49.99, subscriptionCost: 39.99, rarityTier: "legendary", description: "Commemorative film representation." },
  { shopifyProductId: "10547106152613", shopifyVariantId: "47746565439653", handle: "dubnium-film-cube", title: "Dubnium 50mm Lucite Cube", sku: "Db2x2_film", symbol: "Db", name: "Dubnium", number: 105, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 1, priceUsd: 49.99, retailPrice: 49.99, subscriptionCost: 39.99, rarityTier: "legendary", description: "Synthetic element in film form." },
  { shopifyProductId: "10547106185381", shopifyVariantId: "47746565472421", handle: "protactinium-2-lucite-cube", title: "Protactinium 50mm Lucite Cube", sku: "Pa2x2", symbol: "Pa", name: "Protactinium", number: 91, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 2, priceUsd: 299.99, retailPrice: 299.99, subscriptionCost: 199.99, rarityTier: "ultra-rare", description: "One of the rarest elements." },
  { shopifyProductId: "10547106218149", shopifyVariantId: "47746565505189", handle: "aluminum-2-lucite-cube", title: "Aluminum 50mm Lucite Cube", sku: "Al2x2", symbol: "Al", name: "Aluminum", number: 13, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 4, priceUsd: 59.99, retailPrice: 59.99, subscriptionCost: 44.99, rarityTier: "common", description: "Pure aluminum sample." },
  { shopifyProductId: "10547106250917", shopifyVariantId: "47746565537957", handle: "lanthanum-2-lucite-cube", title: "Lanthanum 50mm Lucite Cube", sku: "La2x2", symbol: "La", name: "Lanthanum", number: 57, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 4, priceUsd: 79.99, retailPrice: 79.99, subscriptionCost: 62.99, rarityTier: "uncommon", description: "First of the lanthanides." },
  { shopifyProductId: "10547106283685", shopifyVariantId: "47746565570725", handle: "magnesium-2-lucite-cube", title: "Magnesium 50mm Lucite Cube", sku: "Mg2x2", symbol: "Mg", name: "Magnesium", number: 12, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 4, priceUsd: 69.99, retailPrice: 69.99, subscriptionCost: 54.99, rarityTier: "common", description: "Attention-demanding magnesium." },
  { shopifyProductId: "10547106316453", shopifyVariantId: "47746565603493", handle: "yttrium-2-lucite-cube", title: "Yttrium 50mm Lucite Cube", sku: "Y2x2", symbol: "Y", name: "Yttrium", number: 39, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 2, priceUsd: 89.99, retailPrice: 89.99, subscriptionCost: 69.99, rarityTier: "uncommon", description: "Named after Ytterby." },
  { shopifyProductId: "10547106349221", shopifyVariantId: "47746565636261", handle: "tin-2-lucite-cube", title: "Tin 50mm Lucite Cube", sku: "Sn2x2", symbol: "Sn", name: "Tin", number: 50, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 9, priceUsd: 74.99, retailPrice: 74.99, subscriptionCost: 59.99, rarityTier: "common", description: "Warm tin charm." },
  { shopifyProductId: "10547106381989", shopifyVariantId: "47746565669029", handle: "erbium-2-lucite-cube", title: "Erbium 50mm Lucite Cube", sku: "Er2x2", symbol: "Er", name: "Erbium", number: 68, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 3, priceUsd: 94.99, retailPrice: 94.99, subscriptionCost: 74.99, rarityTier: "uncommon", description: "Pink-tinged erbium oxide." },
  { shopifyProductId: "10547106414757", shopifyVariantId: "47746565701797", handle: "europium-2-lucite-cube", title: "Europium 50mm Lucite Cube", sku: "Eu2x2", symbol: "Eu", name: "Europium", number: 63, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 1, priceUsd: 149.99, retailPrice: 149.99, subscriptionCost: 109.99, rarityTier: "rare", description: "Luminescent europium." },
  { shopifyProductId: "10547106447525", shopifyVariantId: "47746565734565", handle: "arsenic-2-lucite-cube", title: "Arsenic 50mm Lucite Cube", sku: "As2x2", symbol: "As", name: "Arsenic", number: 33, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 3, priceUsd: 84.99, retailPrice: 84.99, subscriptionCost: 66.99, rarityTier: "uncommon", description: "Pure crystalline arsenic." },
  { shopifyProductId: "10547106480293", shopifyVariantId: "47746565767333", handle: "gold-2-lucite-cube", title: "Gold 50mm Lucite Cube", sku: "Au2x2_cry", symbol: "Au", name: "Gold", number: 79, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 2, priceUsd: 499.99, retailPrice: 499.99, subscriptionCost: 399.99, rarityTier: "ultra-rare", description: "Pure gold in Lucite." },
  { shopifyProductId: "10547106513061", shopifyVariantId: "47746565800101", handle: "silicon-2-lucite-cube", title: "Silicon 50mm Lucite Cube", sku: "Si2x2", symbol: "Si", name: "Silicon", number: 14, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], status: "Active", inventoryQty: 3, priceUsd: 69.99, retailPrice: 69.99, subscriptionCost: 54.99, rarityTier: "common", description: "Silicon crystal in Lucite." },
  // 10mm Metal Cubes
  { shopifyProductId: "prod_10mm_al", shopifyVariantId: "var_10mm_al", handle: "aluminum-10mm-cube", title: "Aluminum 10mm Metal Cube", sku: "Al_10mm", symbol: "Al", name: "Aluminum", number: 13, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], status: "Active", inventoryQty: 12, priceUsd: 14.99, retailPrice: 14.99, subscriptionCost: 11.99, rarityTier: "common", description: "Precision-machined 10mm aluminum cube." },
  { shopifyProductId: "prod_10mm_cu", shopifyVariantId: "var_10mm_cu", handle: "copper-10mm-cube", title: "Copper 10mm Metal Cube", sku: "Cu_10mm", symbol: "Cu", name: "Copper", number: 29, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], status: "Active", inventoryQty: 15, priceUsd: 12.99, retailPrice: 12.99, subscriptionCost: 9.99, rarityTier: "common", description: "10mm copper cube." },
  { shopifyProductId: "prod_10mm_fe", shopifyVariantId: "var_10mm_fe", handle: "iron-10mm-cube", title: "Iron 10mm Metal Cube", sku: "Fe_10mm", symbol: "Fe", name: "Iron", number: 26, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], status: "Active", inventoryQty: 20, priceUsd: 9.99, retailPrice: 9.99, subscriptionCost: 7.99, rarityTier: "common", description: "10mm iron cube." },
  { shopifyProductId: "prod_10mm_ti", shopifyVariantId: "var_10mm_ti", handle: "titanium-10mm-cube", title: "Titanium 10mm Metal Cube", sku: "Ti_10mm", symbol: "Ti", name: "Titanium", number: 22, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], status: "Active", inventoryQty: 8, priceUsd: 19.99, retailPrice: 19.99, subscriptionCost: 15.99, rarityTier: "uncommon", description: "10mm titanium cube." },
  { shopifyProductId: "prod_10mm_w", shopifyVariantId: "var_10mm_w", handle: "tungsten-10mm-cube", title: "Tungsten 10mm Metal Cube", sku: "W_10mm", symbol: "W", name: "Tungsten", number: 74, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], status: "Active", inventoryQty: 6, priceUsd: 24.99, retailPrice: 24.99, subscriptionCost: 19.99, rarityTier: "uncommon", description: "Dense tungsten cube." },
  // 25.4mm Metal Cubes
  { shopifyProductId: "prod_25mm_al", shopifyVariantId: "var_25mm_al", handle: "aluminum-25mm-cube", title: "Aluminum 25.4mm Metal Cube", sku: "Al_25mm", symbol: "Al", name: "Aluminum", number: 13, category: "Metal Cube", format: "25.4mm", collectionTypes: ["25.4mm"], status: "Active", inventoryQty: 6, priceUsd: 39.99, retailPrice: 39.99, subscriptionCost: 31.99, rarityTier: "common", description: "1-inch aluminum cube." },
  { shopifyProductId: "prod_25mm_cu", shopifyVariantId: "var_25mm_cu", handle: "copper-25mm-cube", title: "Copper 25.4mm Metal Cube", sku: "Cu_25mm", symbol: "Cu", name: "Copper", number: 29, category: "Metal Cube", format: "25.4mm", collectionTypes: ["25.4mm"], status: "Active", inventoryQty: 5, priceUsd: 44.99, retailPrice: 44.99, subscriptionCost: 35.99, rarityTier: "common", description: "1-inch copper cube." },
  { shopifyProductId: "prod_25mm_ti", shopifyVariantId: "var_25mm_ti", handle: "titanium-25mm-cube", title: "Titanium 25.4mm Metal Cube", sku: "Ti_25mm", symbol: "Ti", name: "Titanium", number: 22, category: "Metal Cube", format: "25.4mm", collectionTypes: ["25.4mm"], status: "Active", inventoryQty: 4, priceUsd: 59.99, retailPrice: 59.99, subscriptionCost: 47.99, rarityTier: "uncommon", description: "1-inch titanium cube." },
  // Ampoules
  { shopifyProductId: "prod_amp_na", shopifyVariantId: "var_amp_na", handle: "sodium-ampoule", title: "Sodium Sealed Ampoule", sku: "Na_amp", symbol: "Na", name: "Sodium", number: 11, category: "Ampoule", format: "ampoule", collectionTypes: ["ampoules"], status: "Active", inventoryQty: 10, priceUsd: 24.99, retailPrice: 24.99, subscriptionCost: 19.99, rarityTier: "common", description: "Sodium sealed under argon." },
  { shopifyProductId: "prod_amp_k", shopifyVariantId: "var_amp_k", handle: "potassium-ampoule", title: "Potassium Sealed Ampoule", sku: "K_amp", symbol: "K", name: "Potassium", number: 19, category: "Ampoule", format: "ampoule", collectionTypes: ["ampoules"], status: "Active", inventoryQty: 8, priceUsd: 29.99, retailPrice: 29.99, subscriptionCost: 23.99, rarityTier: "common", description: "Potassium sealed under argon." },
  { shopifyProductId: "prod_amp_cs", shopifyVariantId: "var_amp_cs", handle: "cesium-ampoule", title: "Cesium Sealed Ampoule", sku: "Cs_amp", symbol: "Cs", name: "Cesium", number: 55, category: "Ampoule", format: "ampoule", collectionTypes: ["ampoules"], status: "Active", inventoryQty: 3, priceUsd: 89.99, retailPrice: 89.99, subscriptionCost: 69.99, rarityTier: "rare", description: "Cesium sealed in glass ampoule." },
  { shopifyProductId: "prod_amp_ga", shopifyVariantId: "var_amp_ga", handle: "gallium-ampoule", title: "Gallium Sealed Ampoule", sku: "Ga_amp", symbol: "Ga", name: "Gallium", number: 31, category: "Ampoule", format: "ampoule", collectionTypes: ["ampoules"], status: "Active", inventoryQty: 7, priceUsd: 34.99, retailPrice: 34.99, subscriptionCost: 27.99, rarityTier: "uncommon", description: "Gallium that melts in your hand." },
  { shopifyProductId: "prod_amp_rb", shopifyVariantId: "var_amp_rb", handle: "rubidium-ampoule", title: "Rubidium Sealed Ampoule", sku: "Rb_amp", symbol: "Rb", name: "Rubidium", number: 37, category: "Ampoule", format: "ampoule", collectionTypes: ["ampoules"], status: "Active", inventoryQty: 2, priceUsd: 79.99, retailPrice: 79.99, subscriptionCost: 63.99, rarityTier: "rare", description: "Reactive rubidium sealed under inert gas." },
];

// ─── Customer Profiles (6 for Phase 2) ──────────────────────
const CUSTOMERS = [
  { shopifyId: "cust_001", email: "marcus.chen@example.com", firstName: "Marcus", lastName: "Chen", displayName: "The Completionist", collectionType: "lucite" },
  { shopifyId: "cust_002", email: "sarah.kovacs@example.com", firstName: "Sarah", lastName: "Kovacs", displayName: "The Curator", collectionType: "lucite" },
  { shopifyId: "cust_003", email: "david.nakamura@example.com", firstName: "David", lastName: "Nakamura", displayName: "The Newcomer", collectionType: "10mm" },
  { shopifyId: "cust_004", email: "elena.ross@example.com", firstName: "Elena", lastName: "Ross", displayName: "The Completionist Elite", collectionType: "lucite" },
  { shopifyId: "cust_005", email: "james.wright@example.com", firstName: "James", lastName: "Wright", displayName: "The Precision Collector", collectionType: "25.4mm" },
  { shopifyId: "cust_006", email: "mia.torres@example.com", firstName: "Mia", lastName: "Torres", displayName: "The Scientist", collectionType: "ampoules" },
];

async function main() {
  console.log("🧪 Seeding Luciteria Collector Cabinet database (Phase 2 + Subscription System)...\n");

  // Clear existing data (order matters for FK constraints)
  // New subscription system tables
  await prisma.packOrder.deleteMany();
  await prisma.collectorPack.deleteMany();
  await prisma.subscriptionSku.deleteMany();
  await prisma.creditTransaction.deleteMany();
  await prisma.userSubscription.deleteMany();
  await prisma.userOwnedSku.deleteMany();
  await prisma.completionGoal.deleteMany();
  await prisma.curationRequest.deleteMany();
  await prisma.featureFlag.deleteMany();
  // Original tables
  await prisma.notificationLog.deleteMany();
  await prisma.pricingHistory.deleteMany();
  await prisma.collectionTypeChange.deleteMany();
  await prisma.adminNote.deleteMany();
  await prisma.assignmentException.deleteMany();
  await prisma.inventoryLog.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.subscriptionShipment.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.wishlistItem.deleteMany();
  await prisma.collectionRecord.deleteMany();
  await prisma.customerPreference.deleteMany();
  await prisma.product.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.membershipTier.deleteMany();

  // ── Seed Products ─────────────────────────────────────────
  console.log("📦 Creating products...");
  const products = [];
  for (const p of PRODUCTS) {
    const product = await prisma.product.create({
      data: {
        shopifyProductId: p.shopifyProductId,
        shopifyVariantId: p.shopifyVariantId,
        handle: p.handle,
        title: p.title,
        description: p.description,
        sku: p.sku,
        elementSymbol: p.symbol,
        elementName: p.name,
        atomicNumber: p.number,
        category: p.category,
        format: p.format,
        collectionTypes: JSON.stringify(p.collectionTypes),
        status: p.status,
        inventoryQty: p.inventoryQty,
        priceUsd: p.priceUsd,
        retailPrice: p.retailPrice,
        subscriptionCost: p.subscriptionCost,
        rarityTier: p.rarityTier,
      },
    });
    products.push(product);
  }
  console.log(`   ✓ Created ${products.length} products\n`);

  // ── Seed Customers ────────────────────────────────────────
  console.log("👤 Creating customers...");
  const customers = [];
  for (const c of CUSTOMERS) {
    const customer = await prisma.customer.create({
      data: {
        ...c,
        onboardedAt: new Date(),
      },
    });
    customers.push(customer);
  }
  console.log(`   ✓ Created ${customers.length} customers\n`);

  const [marcus, sarah, david, elena, james, mia] = customers;

  // ── Collection Records ────────────────────────────────────
  console.log("🗄️  Creating collection records...");
  const luciteProducts = products.filter(p => p.sku.includes("2x2") || p.sku.includes("_liq") || p.sku.includes("_film") || p.sku.includes("_cry"));

  // Marcus owns 16 of 20 lucite (missing: Pa, Db, Au, Eu)
  const marcusOwns = luciteProducts.filter(p => !["Pa2x2", "Db2x2_film", "Au2x2_cry", "Eu2x2"].includes(p.sku));
  for (const p of marcusOwns) {
    await prisma.collectionRecord.create({
      data: { customerId: marcus.id, productId: p.id, acquiredVia: "subscription", acquiredDate: new Date(2025, Math.floor(Math.random() * 12), 15) },
    });
  }

  // Sarah owns 8 lucite items
  const sarahSKUs = ["Na2x2", "Cr2x2", "S2x2", "Al2x2", "Mg2x2", "Sn2x2", "Si2x2", "Sr2x2"];
  for (const p of luciteProducts.filter(p => sarahSKUs.includes(p.sku))) {
    await prisma.collectionRecord.create({
      data: { customerId: sarah.id, productId: p.id, acquiredVia: "purchase", acquiredDate: new Date(2025, 8, 15) },
    });
  }

  // David owns 3 10mm cubes
  const davidSKUs = ["Fe_10mm", "Cu_10mm", "Al_10mm"];
  for (const p of products.filter(p => davidSKUs.includes(p.sku))) {
    await prisma.collectionRecord.create({
      data: { customerId: david.id, productId: p.id, acquiredVia: "subscription", acquiredDate: new Date(2026, 3, 15) },
    });
  }

  // Elena owns all 20 lucite
  for (const p of luciteProducts) {
    await prisma.collectionRecord.create({
      data: { customerId: elena.id, productId: p.id, acquiredVia: "subscription", acquiredDate: new Date(2024, Math.floor(Math.random() * 12), 15) },
    });
  }

  // James owns 2 25.4mm cubes
  for (const p of products.filter(p => ["Al_25mm", "Cu_25mm"].includes(p.sku))) {
    await prisma.collectionRecord.create({
      data: { customerId: james.id, productId: p.id, acquiredVia: "purchase", acquiredDate: new Date(2026, 3, 1) },
    });
  }

  // Mia owns 1 ampoule
  for (const p of products.filter(p => p.sku === "Na_amp")) {
    await prisma.collectionRecord.create({
      data: { customerId: mia.id, productId: p.id, acquiredVia: "subscription", acquiredDate: new Date(2026, 4, 1) },
    });
  }
  console.log("   ✓ Collection records created\n");

  // ── Subscriptions with grandfathering ─────────────────────
  console.log("📬 Creating subscriptions...");
  for (const subData of [
    { customerId: marcus.id, planName: "Completionist", planTier: "ultimate", priceUsd: 149.99, originalPrice: 129.99, startDate: new Date(2025, 0, 15) },
    { customerId: sarah.id, planName: "Element Explorer", planTier: "basic", priceUsd: 79.99, originalPrice: 79.99, startDate: new Date(2025, 6, 1) },
    { customerId: david.id, planName: "Element Explorer", planTier: "basic", priceUsd: 79.99, originalPrice: 79.99, startDate: new Date(2026, 4, 1) },
    { customerId: elena.id, planName: "Completionist", planTier: "ultimate", priceUsd: 149.99, originalPrice: 119.99, startDate: new Date(2024, 0, 1) },
    { customerId: james.id, planName: "Element Explorer", planTier: "basic", priceUsd: 79.99, originalPrice: 79.99, startDate: new Date(2026, 3, 28) },
    { customerId: mia.id, planName: "Element Explorer", planTier: "basic", priceUsd: 79.99, originalPrice: 79.99, startDate: new Date(2026, 4, 1) },
  ]) {
    const priceExpiry = new Date(subData.startDate);
    priceExpiry.setMonth(priceExpiry.getMonth() + 12);
    await prisma.subscription.create({
      data: {
        customerId: subData.customerId,
        planName: subData.planName,
        planTier: subData.planTier,
        status: "active",
        billingCadence: "monthly",
        priceUsd: subData.priceUsd,
        originalPrice: subData.originalPrice,
        currentPrice: subData.priceUsd,
        priceLockedAt: subData.startDate,
        priceExpiresAt: priceExpiry,
        nextShipmentDate: new Date(2026, 5, 1),
        nextBillingDate: new Date(2026, 5, 1),
        startDate: subData.startDate,
        itemsPerShipment: 1,
      },
    });
  }
  console.log("   ✓ Subscriptions created\n");

  // ── Preferences ───────────────────────────────────────────
  console.log("⚙️  Creating preferences...");
  for (const prefData of [
    { customerId: marcus.id, duplicateHandling: "never", cats: ["Lucite Cube"], fmts: ["50mm"] },
    { customerId: sarah.id, duplicateHandling: "missing_only", cats: ["Lucite Cube"], fmts: ["50mm"] },
    { customerId: david.id, duplicateHandling: "surprise", cats: [], fmts: ["10mm"] },
    { customerId: elena.id, duplicateHandling: "curated_subs", cats: ["Lucite Cube"], fmts: ["50mm"], budget: 500 },
    { customerId: james.id, duplicateHandling: "never", cats: ["Metal Cube"], fmts: ["25.4mm"] },
    { customerId: mia.id, duplicateHandling: "missing_only", cats: ["Ampoule"], fmts: ["ampoule"] },
  ]) {
    await prisma.customerPreference.create({
      data: {
        customerId: prefData.customerId,
        duplicateHandling: prefData.duplicateHandling,
        preferredCategories: JSON.stringify(prefData.cats),
        excludedCategories: JSON.stringify([]),
        preferredFormats: JSON.stringify(prefData.fmts),
        budgetMaxUsd: prefData.budget || null,
        communicationEmail: true,
        shipmentNotifications: true,
        restockAlerts: true,
      },
    });
  }
  console.log("   ✓ Preferences created\n");

  // ── Membership Tiers ─────────────────────────────────────
  console.log("🏆 Creating membership tiers...");
  const bronze = await prisma.membershipTier.create({
    data: { name: "Bronze", displayName: "Bronze Collector", monthlyPrice: 29.99, storeCredit: 10.0, sortOrder: 1, earlyAccessDays: 0 },
  });
  const silver = await prisma.membershipTier.create({
    data: { name: "Silver", displayName: "Silver Collector", monthlyPrice: 59.99, storeCredit: 25.0, sortOrder: 2, earlyAccessDays: 3 },
  });
  const gold = await prisma.membershipTier.create({
    data: { name: "Gold", displayName: "Gold Collector", monthlyPrice: 99.99, storeCredit: 50.0, sortOrder: 3, earlyAccessDays: 7 },
  });
  console.log("   ✓ 3 tiers created: Bronze, Silver, Gold\n");

  // ── Feature Flags ──────────────────────────────────────
  console.log("🚩 Creating feature flags...");
  const FLAGS = [
    { flagName: "phase2_ownership_tracking", isEnabled: false, description: "Track user SKU ownership" },
    { flagName: "phase2_completion_display", isEnabled: false, description: "Show completion progress UI" },
    { flagName: "phase2_suggestions", isEnabled: false, description: "Display missing element suggestions" },
    { flagName: "phase3_enabled", isEnabled: false, description: "Dynamic curation system (always false)" },
  ];
  for (const flag of FLAGS) {
    await prisma.featureFlag.create({ data: flag });
  }
  console.log(`   ✓ ${FLAGS.length} feature flags created\n`);

  // ── Subscription SKUs ──────────────────────────────────
  console.log("🔗 Marking SKUs as subscription-eligible...");
  const eligibleSkus = products.slice(0, 25); // First 25 products
  for (const p of eligibleSkus) {
    await prisma.subscriptionSku.create({
      data: {
        sku: p.sku,
        productId: p.id,
        isEligible: true,
        isSubscriberOnly: p.rarityTier === "ultra-rare" || p.rarityTier === "legendary",
        isEarlyAccess: p.rarityTier === "rare" || p.rarityTier === "ultra-rare",
      },
    });
  }
  console.log(`   ✓ ${eligibleSkus.length} SKUs marked as eligible\n`);

  // ── Collector Packs ────────────────────────────────────
  console.log("📦 Creating collector packs...");
  const luciteSkus = products.filter(p => p.sku.includes("2x2")).slice(0, 5);
  const metalSkus = products.filter(p => p.sku.includes("10mm")).slice(0, 3);
  const ampouleSkus = products.filter(p => p.sku.includes("_amp")).slice(0, 3);

  const PACKS = [
    { name: "Rare Earth Pack", description: "A curated selection of rare earth elements in Lucite.", itemCount: 5, skuList: luciteSkus.map(p => p.sku), tierId: null, price: 349.99, creditCost: 300 },
    { name: "Starter Metal Cubes", description: "Essential 10mm cubes to kick off your collection.", itemCount: 3, skuList: metalSkus.map(p => p.sku), tierId: null, price: 34.99, creditCost: 30 },
    { name: "Reactive Metals Pack", description: "Sealed ampoules of the most reactive elements.", itemCount: 3, skuList: ampouleSkus.map(p => p.sku), tierId: null, price: 74.99, creditCost: 65 },
    { name: "Premium Lucite Collection", description: "Five premium Lucite cubes including rare specimens.", itemCount: 5, skuList: luciteSkus.map(p => p.sku), tierId: silver.id, price: 299.99, creditCost: 250 },
    { name: "Gold Exclusive Pack", description: "Ultra-rare elements reserved for Gold members.", itemCount: 3, skuList: metalSkus.map(p => p.sku), tierId: gold.id, price: null, creditCost: 100 },
  ];
  for (const pack of PACKS) {
    await prisma.collectorPack.create({
      data: { ...pack, skuList: JSON.stringify(pack.skuList) },
    });
  }
  console.log(`   ✓ ${PACKS.length} collector packs created\n`);

  console.log("✅ Phase 2 + Subscription System seed complete!\n");

  // ═══════════════════════════════════════════════════════════════
  // COLLECTION-FIRST PHASE 1: Seed test CollectionItems & Milestones
  // ═══════════════════════════════════════════════════════════════
  console.log("🧊 Seeding collection-first test data...");

  // Check if any Users exist (from auth system)
  const users = await prisma.user.findMany({ take: 1 });
  if (users.length > 0) {
    const testUser = users[0];
    console.log(`   Using user: ${testUser.email}`);

    // Seed some collection items
    const OWNED_ELEMENTS = [
      { sym: "H", name: "Hydrogen", z: 1 },
      { sym: "He", name: "Helium", z: 2 },
      { sym: "Li", name: "Lithium", z: 3 },
      { sym: "C", name: "Carbon", z: 6 },
      { sym: "N", name: "Nitrogen", z: 7 },
      { sym: "O", name: "Oxygen", z: 8 },
      { sym: "Fe", name: "Iron", z: 26 },
      { sym: "Cu", name: "Copper", z: 29 },
      { sym: "Ag", name: "Silver", z: 47 },
      { sym: "Au", name: "Gold", z: 79 },
    ];
    const WANTED_ELEMENTS = [
      { sym: "Ne", name: "Neon", z: 10 },
      { sym: "Ar", name: "Argon", z: 18 },
      { sym: "Kr", name: "Krypton", z: 36 },
    ];
    const WATCHLIST_ELEMENTS = [
      { sym: "Pt", name: "Platinum", z: 78 },
      { sym: "Pd", name: "Palladium", z: 46 },
    ];

    for (const el of OWNED_ELEMENTS) {
      await prisma.collectionItem.upsert({
        where: { userId_elementSymbol: { userId: testUser.id, elementSymbol: el.sym } },
        update: { state: "OWNED" },
        create: { userId: testUser.id, elementSymbol: el.sym, elementName: el.name, atomicNumber: el.z, state: "OWNED", acquiredVia: "manual", acquiredDate: new Date() },
      });
    }
    for (const el of WANTED_ELEMENTS) {
      await prisma.collectionItem.upsert({
        where: { userId_elementSymbol: { userId: testUser.id, elementSymbol: el.sym } },
        update: { state: "WANTED" },
        create: { userId: testUser.id, elementSymbol: el.sym, elementName: el.name, atomicNumber: el.z, state: "WANTED" },
      });
    }
    for (const el of WATCHLIST_ELEMENTS) {
      await prisma.collectionItem.upsert({
        where: { userId_elementSymbol: { userId: testUser.id, elementSymbol: el.sym } },
        update: { state: "WATCHLIST" },
        create: { userId: testUser.id, elementSymbol: el.sym, elementName: el.name, atomicNumber: el.z, state: "WATCHLIST" },
      });
    }
    console.log(`   ✓ ${OWNED_ELEMENTS.length} owned, ${WANTED_ELEMENTS.length} wanted, ${WATCHLIST_ELEMENTS.length} watchlist items seeded`);

    // Seed milestones
    await prisma.milestone.upsert({
      where: { userId_type: { userId: testUser.id, type: "first_element" } },
      update: {},
      create: { userId: testUser.id, type: "first_element", title: "First Element!", description: "Added your first element to your collection", icon: "🎉" },
    });
    await prisma.milestone.upsert({
      where: { userId_type: { userId: testUser.id, type: "count_10" } },
      update: {},
      create: { userId: testUser.id, type: "count_10", title: "Decadent Decade", description: "Own 10 or more elements", icon: "🔟" },
    });
    console.log("   ✓ 2 milestones seeded");

    // Seed activity log
    await prisma.activityLog.create({
      data: { userId: testUser.id, action: "state_changed", elementSymbol: "Fe", details: JSON.stringify({ from: "MISSING", to: "OWNED" }) },
    });
    await prisma.activityLog.create({
      data: { userId: testUser.id, action: "milestone_earned", details: JSON.stringify({ type: "first_element", title: "First Element!" }) },
    });
    console.log("   ✓ Activity log entries seeded");
  } else {
    console.log("   ⚠ No users found — skipping collection seed (create a user first via onboarding)");
  }

  console.log("\n✅ Collection-first Phase 1 seed complete!\n");

  // ═══════════════════════════════════════════════════════════════
  // PHASE 2A: Create admin user for testing
  // ═══════════════════════════════════════════════════════════════
  console.log("🔑 Seeding admin user...");
  try {
    const adminEmail = "admin@luciteria.com";
    const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
    if (existing) {
      // Ensure isStaff is set
      await prisma.user.update({ where: { email: adminEmail }, data: { isStaff: true } });
      console.log(`   ✓ Admin user already exists (${adminEmail}) — ensured isStaff=true`);
    } else {
      const passwordHash = await bcrypt.hash("admin123", 10);
      await prisma.user.create({
        data: {
          email: adminEmail,
          passwordHash,
          firstName: "Admin",
          lastName: "User",
          isStaff: true,
          onboardingCompleted: true,
          onboardingStep: 5,
          wishlistToken: uuidv4(),
        },
      });
      console.log(`   ✓ Admin user created: ${adminEmail} / admin123`);
    }

    // Also promote the first existing user to staff (for testing convenience)
    const firstUser = await prisma.user.findFirst({ orderBy: { createdAt: "asc" } });
    if (firstUser && !firstUser.isStaff) {
      await prisma.user.update({ where: { id: firstUser.id }, data: { isStaff: true } });
      console.log(`   ✓ Promoted ${firstUser.email} to staff for testing`);
    }
  } catch (seedAdminErr) {
    console.log("   ⚠ Admin user seeding skipped:", seedAdminErr.message);
  }
  console.log("✅ Phase 2A admin seed complete!\n");
}

main()
  .catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
