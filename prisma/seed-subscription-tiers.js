/**
 * Luciteria Collector Cabinet — Subscription Tier Seed
 *
 * Migrates the 3 launch tiers (10mm, 25.4mm, Lucite) from the static config
 * file (`app/config/subscription-tiers.server.js`) into the `SubscriptionTier`
 * table, preserving their current settings. Idempotent: re-running upserts by
 * the unique tier key (`name`) without duplicating rows.
 *
 * Run:  node prisma/seed-subscription-tiers.js
 *   or: DATABASE_URL=... node prisma/seed-subscription-tiers.js
 */

import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import { SUBSCRIPTION_TIERS } from "../app/config/subscription-tiers.server.js";

const prisma = new PrismaClient();

/** Human-readable descriptions per collection type for the seeded tiers. */
const DESCRIPTIONS = {
  "10mm": "Monthly 10mm element cubes. One curated cube per shipment, precious metals excluded.",
  "25.4mm": "Monthly 25.4mm (1 inch) element cubes. One curated cube per shipment, precious metals excluded.",
  lucite: "Monthly Lucite-embedded element specimens. One curated piece per shipment, precious metals excluded.",
};

async function main() {
  console.log(`Seeding ${SUBSCRIPTION_TIERS.length} subscription tiers…`);

  for (const cfg of SUBSCRIPTION_TIERS) {
    const data = {
      displayName: cfg.displayName,
      description: DESCRIPTIONS[cfg.collectionType] || null,
      collectionType: cfg.collectionType,
      allowedCollectionTypes: [cfg.collectionType],
      monthlyPrice: cfg.monthlyPrice,
      creditValue: cfg.monthlyPrice, // launch tiers grant credit equal to the monthly price
      discountPercentage: cfg.maxDiscountPercent,
      billingInterval: cfg.billingInterval,
      billingIntervalCount: cfg.billingIntervalCount,
      excludePreciousMetals: cfg.excludePreciousMetals,
      maxDiscountPercent: cfg.maxDiscountPercent,
      itemsPerShipment: cfg.itemsPerShipment,
      defaultStrategy: cfg.defaultStrategy,
      allowDuplicates: cfg.allowDuplicates,
      isActive: true,
      sortOrder: cfg.sortOrder,
      displayOrder: cfg.sortOrder,
      updatedBy: "seed",
    };

    const row = await prisma.subscriptionTier.upsert({
      where: { name: cfg.name },
      update: data,
      create: { name: cfg.name, createdBy: "seed", ...data },
    });
    console.log(`  ✓ ${row.name} (${row.collectionType}) — $${row.monthlyPrice}/mo`);
  }

  const count = await prisma.subscriptionTier.count();
  console.log(`Done. SubscriptionTier rows in DB: ${count}`);
}

main()
  .catch((err) => {
    console.error("Tier seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
