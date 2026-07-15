/**
 * Focused test for the database-backed subscription tier service.
 * Run: APP_MODE=prototype DATABASE_URL=... node_modules/.bin/vite-node scratch/test-tiers-db.mjs
 */
import { prisma } from "../app/lib/db.server.js";
import {
  getAllTiers,
  getTierByKey,
  getTierBySellingPlanId,
  getTierByCollectionType,
  resolveTierKey,
  validateTierConfig,
  invalidateTierCache,
  upsertTier,
} from "../app/lib/subscription-tiers-db.server.js";

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

async function main() {
  // Ensure the 3 tiers are seeded and carry a selling plan id for lookup test.
  await upsertTier(
    {
      name: "10mm_monthly", displayName: "10mm Cubes — Monthly", collectionType: "10mm",
      allowedCollectionTypes: ["10mm"], monthlyPrice: 49.99, discountPercentage: 0.20,
      maxDiscountPercent: 0.20, appstleSellingPlanId: "gid://appstle/SP/TEST-10MM",
    },
    { actorEmail: "test" }
  );

  // getAllTiers
  const all = await getAllTiers();
  ok(all.length >= 1, `getAllTiers returned ${all.length} active tiers`);
  ok(all.every((t) => typeof t.monthlyPrice === "number"), "all tiers have numeric monthlyPrice");

  // getTierByKey
  const t10 = await getTierByKey("10mm_monthly");
  ok(t10 && t10.collectionType === "10mm", "getTierByKey('10mm_monthly') → 10mm tier");
  ok((await getTierByKey("does_not_exist")) === null, "getTierByKey(unknown) → null");

  // getTierBySellingPlanId
  const bySp = await getTierBySellingPlanId("gid://appstle/SP/TEST-10MM");
  ok(bySp && bySp.name === "10mm_monthly", "getTierBySellingPlanId → 10mm_monthly");
  ok((await getTierBySellingPlanId("nope")) === null, "getTierBySellingPlanId(unknown) → null");

  // getTierByCollectionType + fallback (never null)
  const luc = await getTierByCollectionType("lucite");
  ok(luc && luc.monthlyPrice > 0, "getTierByCollectionType('lucite') resolves");
  const fallback = await getTierByCollectionType("totally-unknown-type");
  ok(fallback && fallback.name, "getTierByCollectionType(unknown) falls back (never null)");

  // resolveTierKey via selling plan id
  const key = await resolveTierKey({ sellingPlanId: "gid://appstle/SP/TEST-10MM" });
  ok(key === "10mm_monthly", "resolveTierKey by selling plan id → 10mm_monthly");

  // Caching: second getAllTiers should be served from cache (same ref length)
  const all2 = await getAllTiers();
  ok(all2.length === all.length, "cached getAllTiers consistent");
  invalidateTierCache();
  const all3 = await getAllTiers();
  ok(all3.length === all.length, "getAllTiers after cache invalidation consistent");

  // Validation
  const validationCases = [
    [{ name: "", displayName: "x", collectionType: "10mm", monthlyPrice: 1 }, "empty key rejected"],
    [{ name: "x", displayName: "", collectionType: "10mm", monthlyPrice: 1 }, "empty displayName rejected"],
    [{ name: "x", displayName: "X", monthlyPrice: 1 }, "no collection type rejected"],
    [{ name: "x", displayName: "X", collectionType: "10mm", monthlyPrice: 0 }, "zero price rejected"],
    [{ name: "x", displayName: "X", collectionType: "10mm", monthlyPrice: -5 }, "negative price rejected"],
    [{ name: "x", displayName: "X", collectionType: "bogus", monthlyPrice: 5 }, "unknown collection type rejected"],
    [{ name: "x", displayName: "X", collectionType: "10mm", monthlyPrice: 5, discountPercentage: 2 }, "discount > 1 rejected"],
  ];
  for (const [cfg, label] of validationCases) {
    let threw = false;
    try { validateTierConfig(cfg); } catch { threw = true; }
    ok(threw, `validation: ${label}`);
  }
  // Valid config passes
  let validOk = false;
  try {
    validateTierConfig({ name: "valid_x", displayName: "Valid", collectionType: "10mm", monthlyPrice: 29.99, discountPercentage: 0.15 });
    validOk = true;
  } catch { validOk = false; }
  ok(validOk, "validation: well-formed tier passes");

  // Duplicate key detection (client-side)
  let dupThrew = false;
  try { validateTierConfig({ name: "10mm_monthly", displayName: "Dup", collectionType: "10mm", monthlyPrice: 5 }, { existingKeys: ["10mm_monthly"] }); }
  catch { dupThrew = true; }
  ok(dupThrew, "validation: duplicate key rejected");

  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  await prisma.$disconnect();
  if (fail > 0) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
