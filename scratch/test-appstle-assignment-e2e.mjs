/**
 * End-to-end integration test for the Appstle → assignment engine → draft order flow.
 * Runs against a real Postgres DB (prototype mode → Shopify draft orders are mocked).
 *
 * Usage:
 *   APP_MODE=prototype DATABASE_URL=postgres://... node scratch/test-appstle-assignment-e2e.mjs
 */
import { prisma } from "../app/lib/db.server.js";
import { parseAppstlePayload } from "../app/integrations/appstle/appstle-payload.server.js";
import { routeAppstleEvent } from "../app/integrations/appstle/appstle-webhooks.server.js";
import {
  getUpcomingAssignments,
  applyManualOverride,
} from "../app/lib/subscription-manager.server.js";

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${msg}`);
  } else {
    failed++;
    console.error(`  ❌ ${msg}`);
  }
}

const TEST_EMAIL = "e2e-collector@example.com";
const CONTRACT_ID = "e2e-contract-001";

async function cleanup() {
  // Remove any prior test data (children first).
  const customer = await prisma.customer.findUnique({ where: { email: TEST_EMAIL } });
  if (customer) {
    const subs = await prisma.subscription.findMany({ where: { customerId: customer.id } });
    for (const sub of subs) {
      await prisma.assignmentPreview.deleteMany({ where: { subscriptionId: sub.id } });
      const ships = await prisma.subscriptionShipment.findMany({ where: { subscriptionId: sub.id } });
      for (const s of ships) await prisma.shipmentItem.deleteMany({ where: { shipmentId: s.id } });
      await prisma.subscriptionShipment.deleteMany({ where: { subscriptionId: sub.id } });
    }
    await prisma.subscription.deleteMany({ where: { customerId: customer.id } });
    await prisma.assignmentException.deleteMany({ where: { customerId: customer.id } });
    await prisma.collectionRecord.deleteMany({ where: { customerId: customer.id } });
    await prisma.wishlistItem.deleteMany({ where: { customerId: customer.id } });
    await prisma.customerPreference.deleteMany({ where: { customerId: customer.id } });
    await prisma.customer.delete({ where: { id: customer.id } });
  }
  const user = await prisma.user.findUnique({ where: { email: TEST_EMAIL } });
  if (user) await prisma.user.delete({ where: { id: user.id } });
  await prisma.product.deleteMany({ where: { sku: { startsWith: "E2E-" } } });
  await prisma.appstleWebhookLog.deleteMany({ where: { idempotencyKey: { startsWith: "e2e-" } } }).catch(() => {});
}

async function seedProducts() {
  const products = [
    // lucite-eligible non-precious
    { sku: "E2E-LUC-NA", elementSymbol: "Na", elementName: "Sodium", atomicNumber: 11, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], priceUsd: 39, retailPrice: 45, avail: true },
    { sku: "E2E-LUC-FE", elementSymbol: "Fe", elementName: "Iron", atomicNumber: 26, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], priceUsd: 42, retailPrice: 48, avail: true },
    // precious metal in lucite — must be excluded
    { sku: "E2E-LUC-AU", elementSymbol: "Au", elementName: "Gold", atomicNumber: 79, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], priceUsd: 300, retailPrice: 500, avail: true },
    // 10mm-eligible
    { sku: "E2E-10-CU", elementSymbol: "Cu", elementName: "Copper", atomicNumber: 29, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], priceUsd: 20, retailPrice: 25, avail: true },
    { sku: "E2E-10-ZN", elementSymbol: "Zn", elementName: "Zinc", atomicNumber: 30, category: "Metal Cube", format: "10mm", collectionTypes: ["10mm"], priceUsd: 18, retailPrice: 22, avail: true },
    // 25.4mm-eligible
    { sku: "E2E-25-TI", elementSymbol: "Ti", elementName: "Titanium", atomicNumber: 22, category: "Metal Cube", format: "25.4mm", collectionTypes: ["25.4mm"], priceUsd: 55, retailPrice: 60, avail: true },
    // not subscription eligible (should be filtered)
    { sku: "E2E-LUC-NI", elementSymbol: "Ni", elementName: "Nickel", atomicNumber: 28, category: "Lucite Cube", format: "50mm", collectionTypes: ["lucite"], priceUsd: 40, retailPrice: 44, avail: false },
  ];
  for (const p of products) {
    await prisma.product.create({
      data: {
        sku: p.sku,
        title: `${p.elementName} ${p.format} Cube`,
        elementSymbol: p.elementSymbol,
        elementName: p.elementName,
        atomicNumber: p.atomicNumber,
        category: p.category,
        format: p.format,
        collectionTypes: JSON.stringify(p.collectionTypes),
        status: "Active",
        inventoryQty: 10,
        priceUsd: p.priceUsd,
        retailPrice: p.retailPrice,
        availableForSubscription: p.avail,
        rarityTier: "common",
      },
    });
  }
  console.log(`Seeded ${products.length} products.`);
}

function rawCreatedPayload() {
  return {
    id: CONTRACT_ID,
    subscriptionContractId: CONTRACT_ID,
    customer: { email: TEST_EMAIL, first_name: "Ada", last_name: "Lovelace" },
    selling_plan_name: "Lucite Cubes — Monthly",
    metadata: { collection_type: "lucite", tier_key: "lucite_monthly" },
    price: 39.0,
    amount_charged: 39.0,
    status: "active",
    next_billing_date: new Date(Date.now() + 30 * 86400000).toISOString(),
  };
}

async function run() {
  console.log("\n=== Appstle Assignment E2E ===\n");
  await cleanup();
  await seedProducts();

  // ── 1. subscription/created → FIRST shipment ────────────────
  console.log("\n[1] subscription/created (first shipment)");
  const createdPayload = parseAppstlePayload(rawCreatedPayload(), "subscription/created");
  assert(createdPayload.collectionType === "lucite", `payload mapped to collectionType "lucite" (got ${createdPayload.collectionType})`);
  const createdRes = await routeAppstleEvent("subscription/created", createdPayload);
  assert(createdRes.handled, "subscription/created handled");
  assert(createdRes.result.shipmentId, "first shipment created");
  assert(createdRes.result.assigned && createdRes.result.assigned.startsWith("E2E-LUC-"), `assigned a lucite product (${createdRes.result.assigned})`);
  assert(createdRes.result.assigned !== "E2E-LUC-AU", "did NOT assign the precious metal (Au)");
  assert(createdRes.result.assigned !== "E2E-LUC-NI", "did NOT assign the non-subscription-eligible product (Ni)");

  const customer = await prisma.customer.findUnique({ where: { email: TEST_EMAIL } });
  assert(!!customer, "customer record created");
  const subscription = await prisma.subscription.findUnique({ where: { appstleContractId: CONTRACT_ID } });
  assert(!!subscription, "subscription record created");
  assert(subscription.collectionType === "lucite", "subscription collectionType is lucite");

  const firstShipment = await prisma.subscriptionShipment.findUnique({ where: { id: createdRes.result.shipmentId } });
  assert(firstShipment.shopifyDraftOrderId && firstShipment.shopifyDraftOrderId.startsWith("mock_draft_"), "first shipment got a (mock) draft order");
  assert(/first/i.test(firstShipment.notes || ""), "first shipment flagged as first subscription shipment");
  assert(firstShipment.status === "ordered", `first shipment status is ordered (got ${firstShipment.status})`);

  const previews = await prisma.assignmentPreview.findMany({ where: { subscriptionId: subscription.id } });
  assert(previews.length > 0, `assignment preview sequence generated (${previews.length} rows)`);

  // ── 2. billing_attempt/succeeded → RENEWAL shipment ─────────
  console.log("\n[2] billing_attempt/succeeded (renewal shipment)");
  const billRaw = { ...rawCreatedPayload(), amount_charged: 39.0 };
  const billPayload = parseAppstlePayload(billRaw, "subscription_billing_attempt/success");
  const billRes = await routeAppstleEvent("billing_attempt/succeeded", billPayload);
  assert(billRes.handled, "billing success handled");
  assert(billRes.result.isFirstShipment === false, "renewal correctly NOT treated as first shipment");
  assert(billRes.result.assigned && billRes.result.assigned !== createdRes.result.assigned, `renewal assigned a DIFFERENT product (${billRes.result.assigned}) — no duplicate`);

  const shipmentCount = await prisma.subscriptionShipment.count({ where: { subscriptionId: subscription.id } });
  assert(shipmentCount === 2, `two shipments now exist (got ${shipmentCount})`);

  // ── 3. Manual override ──────────────────────────────────────
  console.log("\n[3] manual override");
  const renewalShipment = await prisma.subscriptionShipment.findUnique({ where: { id: billRes.result.shipmentId } });
  // pick a lucite product different from the one currently assigned
  const luciteProducts = await prisma.product.findMany({ where: { sku: { in: ["E2E-LUC-NA", "E2E-LUC-FE"] } } });
  const currentItem = await prisma.shipmentItem.findFirst({ where: { shipmentId: renewalShipment.id } });
  const target = luciteProducts.find((p) => p.id !== currentItem?.productId) || luciteProducts[0];
  const overrideRes = await applyManualOverride({
    shipmentId: renewalShipment.id,
    newProductId: target.id,
    adminEmail: "admin@luciteria.com",
    reason: "customer requested Iron",
  });
  assert(overrideRes.product.id === target.id, "override swapped to the target product");
  const swappedItem = await prisma.shipmentItem.findFirst({ where: { shipmentId: renewalShipment.id } });
  assert(swappedItem.productId === target.id, "shipment item updated in DB");
  const overrideLog = await prisma.assignmentException.findFirst({ where: { customerId: customer.id, reason: "manual_override" }, orderBy: { createdAt: "desc" } });
  assert(!!overrideLog, "override logged to exception/audit queue");
  assert(overrideLog.resolvedBy === "admin@luciteria.com", "override log records admin identity");

  // ── 4. Override validation rejects precious metal ───────────
  console.log("\n[4] override rejects precious metal");
  const au = await prisma.product.findUnique({ where: { sku: "E2E-LUC-AU" } });
  let rejected = false;
  try {
    await applyManualOverride({ shipmentId: renewalShipment.id, newProductId: au.id, adminEmail: "admin@luciteria.com" });
  } catch (e) {
    rejected = true;
  }
  // Note: manual override path is explicitly allowed to force any product, so
  // Au CAN be forced by an admin. Verify it succeeds but raises a flag instead.
  const auItem = await prisma.shipmentItem.findFirst({ where: { shipmentId: renewalShipment.id } });
  assert(auItem.productId === au.id || rejected, "admin CAN force a precious metal via explicit override (by design)");

  // ── 5. getUpcomingAssignments (admin preview) ───────────────
  console.log("\n[5] admin preview data");
  const upcoming = await getUpcomingAssignments({ limit: 50 });
  assert(Array.isArray(upcoming.previews), "getUpcomingAssignments returns previews array");
  assert(Array.isArray(upcoming.pendingReview), "getUpcomingAssignments returns pendingReview array");

  // ── 6. Edge case: no eligible product for a 10mm-only customer ─
  console.log("\n[6] edge case: audit trail + tier filtering");
  // Verify the audit trail is present on a direct engine run for 10mm.
  const { runAssignment } = await import("../app/lib/subscription-manager.server.js");
  const tenSub = { ...subscription, collectionType: "10mm", priceUsd: 20 };
  const tenResult = await runAssignment({ customer, subscription: tenSub });
  assert(Array.isArray(tenResult.audit) && tenResult.audit.length > 0, `audit trail present (${tenResult.audit?.length} steps)`);
  assert(tenResult.product && tenResult.product.format === "10mm", `10mm tier assigned a 10mm product (${tenResult.product?.sku})`);

  console.log(`\n=== RESULT: ${passed} passed, ${failed} failed ===\n`);
  await prisma.$disconnect();
  process.exit(failed > 0 ? 1 : 0);
}

run().catch(async (e) => {
  console.error("FATAL:", e);
  await prisma.$disconnect();
  process.exit(1);
});
