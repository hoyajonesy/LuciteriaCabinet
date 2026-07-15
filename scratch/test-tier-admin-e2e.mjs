/**
 * End-to-end test for the subscription-tier admin service (tier-admin.server.js)
 * and the DB-backed tier CRUD it relies on. Exercises create → list → edit →
 * subscriber-count safety guard → activate/deactivate → delete, plus the audit
 * trail and the shared form validation helpers.
 *
 * Run with:
 *   APP_MODE=prototype DATABASE_URL=... node_modules/.bin/vite-node scratch/test-tier-admin-e2e.mjs
 */
import { prisma } from "../app/lib/db.server.js";
import {
  listAllTiersForAdmin,
  getTierForAdmin,
  saveTier,
  setTierActive,
  deleteTier,
  countActiveSubscribers,
  getRecentTierAudit,
} from "../app/lib/tier-admin.server.js";
import { getAllTiers, invalidateTierCache } from "../app/lib/subscription-tiers-db.server.js";
import { validateTierForm, percentToFraction, fractionToPercent, slugifyKey } from "../app/components/tier/tier-form-helpers.js";

let pass = 0, fail = 0;
function ok(cond, msg) {
  if (cond) { pass++; console.log(`  ✅ ${msg}`); }
  else { fail++; console.log(`  ❌ ${msg}`); }
}

const KEY = "e2e_tier_test";
const KEY2 = "e2e_tier_test_2";
let adminUserId = null;
let subId = null;

async function cleanup() {
  await prisma.subscription.deleteMany({ where: { planTier: { in: [KEY, KEY2] } } }).catch(() => {});
  if (subId) await prisma.subscription.deleteMany({ where: { id: subId } }).catch(() => {});
  await prisma.subscriptionTier.deleteMany({ where: { name: { in: [KEY, KEY2] } } }).catch(() => {});
  // Remove any leftover test customer/subscription/user from a prior failed run.
  const leftoverCust = await prisma.customer.findUnique({ where: { email: "e2e-sub@example.com" } }).catch(() => null);
  if (leftoverCust) {
    await prisma.subscription.deleteMany({ where: { customerId: leftoverCust.id } }).catch(() => {});
    await prisma.customer.delete({ where: { id: leftoverCust.id } }).catch(() => {});
  }
  const leftoverAdmin = await prisma.user.findUnique({ where: { email: "e2e-tieradmin@example.com" } }).catch(() => null);
  const uid = adminUserId || leftoverAdmin?.id;
  if (uid) {
    await prisma.activityLog.deleteMany({ where: { userId: uid } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: uid } }).catch(() => {});
  }
  invalidateTierCache();
}

async function main() {
  await cleanup();

  // Seed an admin user (ActivityLog needs a valid userId).
  const admin = await prisma.user.create({
    data: { email: "e2e-tieradmin@example.com", firstName: "E2E", lastName: "Admin", isStaff: true, passwordHash: "x", wishlistToken: `wl_${Date.now()}` },
  });
  adminUserId = admin.id;
  const ctx = { userId: adminUserId, actorEmail: admin.email };

  console.log("\n── form helpers ──");
  ok(slugifyKey("10mm Cubes — Monthly") === "10mm_cubes_monthly", `slugifyKey → ${slugifyKey("10mm Cubes — Monthly")}`);
  ok(percentToFraction("20") === 0.2, "percentToFraction(20) === 0.2");
  ok(fractionToPercent(0.2) === 20, "fractionToPercent(0.2) === 20");
  const badErrors = validateTierForm({ name: "", displayName: "", allowedCollectionTypes: [], monthlyPrice: 0, discountPercentage: 2 });
  ok(badErrors.name && badErrors.displayName && badErrors.allowedCollectionTypes && badErrors.monthlyPrice && badErrors.discountPercentage,
    "validateTierForm flags all invalid fields");
  const goodErrors = validateTierForm({ name: "ok_key", displayName: "OK", allowedCollectionTypes: ["10mm"], monthlyPrice: 49.99, discountPercentage: 0.2 });
  ok(Object.keys(goodErrors).length === 0, "validateTierForm accepts a valid tier");

  console.log("\n── create ──");
  const created = await saveTier({
    name: KEY, displayName: "E2E Test Tier", description: "seeded by test",
    displayOrder: 99, monthlyPrice: 49.99, creditValue: 40, discountPercentage: 0.2,
    maxDiscountPercent: 0.2, appstleSellingPlanId: "gid://test/sp/e2e",
    allowedCollectionTypes: ["10mm", "25.4mm"], collectionType: "10mm",
    excludePreciousMetals: true, isActive: true,
  }, ctx);
  ok(created && created.name === KEY, "tier created");
  ok(created.discountPercentage === 0.2, "discount persisted as fraction 0.2");
  ok(Array.isArray(created.allowedCollectionTypes) && created.allowedCollectionTypes.includes("25.4mm"), "allowedCollectionTypes persisted");

  console.log("\n── list (incl. inactive) ──");
  const list = await listAllTiersForAdmin();
  const found = list.find((t) => t.name === KEY);
  ok(!!found, "created tier appears in admin list");
  ok(typeof found.activeSubscribers === "number", "list rows carry activeSubscribers count");

  console.log("\n── edit / update ──");
  const updated = await saveTier({
    name: KEY, displayName: "E2E Test Tier (edited)", description: "edited",
    displayOrder: 5, monthlyPrice: 59.99, creditValue: 50, discountPercentage: 0.25,
    maxDiscountPercent: 0.25, allowedCollectionTypes: ["10mm"], collectionType: "10mm",
    excludePreciousMetals: true, isActive: true,
  }, ctx);
  ok(updated.monthlyPrice === 59.99, "price updated to 59.99");
  ok(updated.displayName === "E2E Test Tier (edited)", "display name updated");
  const forEdit = await getTierForAdmin(created.id);
  ok(forEdit && forEdit.tier.monthlyPrice === 59.99, "getTierForAdmin returns updated tier + impact counts");

  console.log("\n── subscriber safety guard ──");
  // Attach a live subscriber to the tier, then attempt delete.
  const cust = await prisma.customer.create({
    data: {
      firstName: "Sub", lastName: "Scriber", email: "e2e-sub@example.com",
      displayName: "E2E Subscriber", collectionType: "10mm",
    },
  });
  const now = new Date();
  const sub = await prisma.subscription.create({
    data: {
      customerId: cust.id, planTier: KEY, planName: "E2E", status: "active",
      collectionType: "10mm", billingCadence: "monthly", priceUsd: 59.99,
      nextShipmentDate: now, nextBillingDate: now, startDate: now,
    },
  });
  subId = sub.id;
  invalidateTierCache();
  const count = await countActiveSubscribers(updated);
  ok(count >= 1, `countActiveSubscribers sees the live subscriber (${count})`);
  const blocked = await deleteTier(created.id, ctx);
  ok(blocked.blocked === true && blocked.deleted === false, "delete blocked while subscribers attached");

  console.log("\n── activate / deactivate ──");
  const deactivated = await setTierActive(created.id, false, ctx);
  ok(deactivated.isActive === false, "tier deactivated");
  invalidateTierCache();
  const activeOnly = await getAllTiers();
  ok(!activeOnly.find((t) => t.name === KEY), "deactivated tier hidden from public getAllTiers()");
  await setTierActive(created.id, true, ctx);

  console.log("\n── delete after removing subscriber ──");
  await prisma.subscription.delete({ where: { id: subId } });
  subId = null;
  invalidateTierCache();
  const del = await deleteTier(created.id, ctx);
  ok(del.deleted === true, "tier deleted once no subscribers remain");
  const afterList = await listAllTiersForAdmin();
  ok(!afterList.find((t) => t.name === KEY), "deleted tier gone from admin list");

  console.log("\n── audit trail ──");
  const audit = await getRecentTierAudit(20);
  const actions = audit.filter((a) => a.details?.tierKey === KEY).map((a) => a.action);
  ok(actions.includes("tier_created"), "audit logged tier_created");
  ok(actions.includes("tier_updated"), "audit logged tier_updated");
  ok(actions.includes("tier_deactivated"), "audit logged tier_deactivated");
  ok(actions.includes("tier_deleted"), "audit logged tier_deleted");

  await cleanup();
  console.log(`\n=== RESULT: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(async (err) => {
  console.error("FATAL", err);
  await cleanup().catch(() => {});
  process.exit(1);
});
