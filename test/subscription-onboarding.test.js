/**
 * Gap-6 regression tests — Subscription Owned-Items Onboarding (v1.3).
 *
 * These exercise the server-side logic that has no UI/HTTP surface:
 *  - Format-aware ownership exclusion incl. ElementSample children (FR-1/FR-2).
 *  - Active OwnershipRejection removal from the owned-exclusion set (FR-4/FR-6).
 *  - Atomic first-assignment claim / idempotency (FR-16/FR-17).
 *  - Idempotent onboarding-record creation (FR-16).
 *  - FR-31 flag-off intentional-decision logging (once per contract).
 *  - FR-29 admin manual-complete guard (needs confirmed changes OR a staff note).
 *  - OwnershipRejection idempotency + supersede-on-confirm (FR-6).
 *
 * The prisma client is replaced with an in-memory fake via mock.module so the
 * pure logic can be tested without a database. Real element/format helpers are
 * used unchanged (they are pure), so element symbols must be real ("Fe","Au").
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

/* ─────────────────────────── in-memory fake prisma ─────────────────────────── */

/** Does a row satisfy a prisma-style `where` clause (subset we rely on)? */
function matchWhere(row, where) {
  if (!where) return true;
  for (const [key, cond] of Object.entries(where)) {
    if (key === "OR") {
      if (!Array.isArray(cond) || !cond.some((w) => matchWhere(row, w))) return false;
      continue;
    }
    if (key === "AND") {
      if (!Array.isArray(cond) || !cond.every((w) => matchWhere(row, w))) return false;
      continue;
    }
    if (cond === null) {
      if (row[key] !== null && row[key] !== undefined) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !Array.isArray(cond) && "in" in cond) {
      if (!cond.in.includes(row[key])) return false;
      continue;
    }
    if (row[key] !== cond) return false;
  }
  return true;
}

/** Build one in-memory model backed by an array of seed rows. */
function makeModel(name, seed = []) {
  let counter = 0;
  const rows = seed.map((r) => ({ ...r }));
  const nextId = () => `${name}_${++counter}`;
  return {
    _rows: rows,
    async findMany({ where } = {}) {
      return rows.filter((r) => matchWhere(r, where)).map((r) => ({ ...r }));
    },
    async findFirst({ where } = {}) {
      const hit = rows.find((r) => matchWhere(r, where));
      return hit ? { ...hit } : null;
    },
    async findUnique({ where } = {}) {
      const hit = rows.find((r) => matchWhere(r, where));
      return hit ? { ...hit } : null;
    },
    async count({ where } = {}) {
      return rows.filter((r) => matchWhere(r, where)).length;
    },
    async create({ data }) {
      const row = { id: data.id ?? nextId(), ...data };
      rows.push(row);
      return { ...row };
    },
    async update({ where, data }) {
      const row = rows.find((r) => matchWhere(r, where));
      if (!row) throw new Error(`${name}.update: no row for ${JSON.stringify(where)}`);
      Object.assign(row, data);
      return { ...row };
    },
    async updateMany({ where, data }) {
      let count = 0;
      for (const row of rows) {
        if (matchWhere(row, where)) {
          Object.assign(row, data);
          count += 1;
        }
      }
      return { count };
    },
  };
}

/**
 * A single, STABLE prisma object is mocked once for the whole file (mock.module
 * may only be called once per specifier, and the modules under test capture the
 * `prisma` binding at import time). `resetPrisma` repopulates the SAME object's
 * models in place between tests so each test starts from clean, isolated state.
 */
const prisma = {
  collectionItem: makeModel("collectionItem"),
  elementSample: makeModel("elementSample"),
  ownershipRejection: makeModel("ownershipRejection"),
  subscriptionOnboarding: makeModel("subscriptionOnboarding"),
  activityLog: makeModel("activityLog"),
  // `product` is only needed because app/data/elements.server.js builds the
  // periodic table from the DB at import time; an empty table is fine here.
  product: makeModel("product"),
};

/** Reset every model's rows in place from a fresh seed map. */
function resetPrisma(seeds = {}) {
  for (const name of Object.keys(prisma)) {
    const rows = prisma[name]._rows;
    rows.length = 0;
    for (const r of seeds[name] || []) rows.push({ ...r });
  }
}

mock.module("../app/lib/db.server.js", { namedExports: { prisma } });

const provenance = await import("../app/lib/ownership-provenance.server.js");
const onboarding = await import("../app/lib/subscription-onboarding.server.js");
const manager = await import("../app/lib/subscription-manager.server.js");

/* ─────────────────────────────────── tests ─────────────────────────────────── */

test("computeOnboardingExclusions excludes primary format AND ElementSample child formats (FR-1/FR-2)", async () => {
  resetPrisma({
    collectionItem: [
      {
        id: "ci1",
        userId: "u1",
        elementSymbol: "Fe",
        format: "10mm_cube",
        state: "OWNED",
        rejectedBySubscriber: false,
        subscriberConfirmed: true,
      },
    ],
    elementSample: [
      { id: "es1", userId: "u1", elementSymbol: "Fe", format: "50mm" },
    ],
  });

  const allProducts = [
    { id: "p1", elementSymbol: "Fe", sku: "fe_10mm" }, // → 10mm_cube (owned primary)
    { id: "p2", elementSymbol: "Fe", sku: "fe_50mm" }, // → 50mm_cube (owned via sample)
    { id: "p3", elementSymbol: "Au", sku: "au_10mm" }, // not owned
  ];
  const excluded = await manager.computeOnboardingExclusions("u1", allProducts, {
    confirmedOnly: false,
  });
  assert.deepEqual(excluded.sort(), ["p1", "p2"]);
});

test("an ACTIVE OwnershipRejection removes an owned key from the exclusion set (FR-4/FR-6)", async () => {
  resetPrisma({
    collectionItem: [
      {
        id: "ci1",
        userId: "u1",
        elementSymbol: "Fe",
        format: "10mm_cube",
        state: "OWNED",
        rejectedBySubscriber: false,
        subscriberConfirmed: true,
      },
    ],
    elementSample: [{ id: "es1", userId: "u1", elementSymbol: "Fe", format: "50mm" }],
    ownershipRejection: [
      {
        id: "or1",
        userId: "u1",
        ownableUnitId: "fe|10mm_cube",
        supersededAt: null,
      },
    ],
  });

  const allProducts = [
    { id: "p1", elementSymbol: "Fe", sku: "fe_10mm" }, // rejected → must NOT be excluded
    { id: "p2", elementSymbol: "Fe", sku: "fe_50mm" }, // still owned via sample → excluded
  ];
  const excluded = await manager.computeOnboardingExclusions("u1", allProducts, {
    confirmedOnly: false,
  });
  assert.deepEqual(excluded, ["p2"]);
});

test("claimFirstAssignment is an atomic check-and-set: first caller wins, second loses (FR-16/FR-17)", async () => {
  resetPrisma({
    subscriptionOnboarding: [
      {
        id: "ob1",
        subscriptionContractId: "c1",
        userId: "u1",
        status: "PENDING",
        firstAssignmentTriggered: false,
      },
    ],
  });

  assert.equal(await onboarding.claimFirstAssignment("c1"), true, "first claim wins");
  assert.equal(await onboarding.claimFirstAssignment("c1"), false, "second claim loses");
});

test("claimFirstAssignment returns true for a contract with no onboarding record (feature off / legacy)", async () => {
  resetPrisma({ subscriptionOnboarding: [] });
  assert.equal(await onboarding.claimFirstAssignment("unknown-contract"), true);
});

test("ensureOnboardingForContract is idempotent — returns created:false when a record already exists (FR-16)", async () => {
  resetPrisma({
    subscriptionOnboarding: [
      {
        id: "ob1",
        subscriptionContractId: "c1",
        userId: "u1",
        status: "PENDING",
        firstAssignmentTriggered: false,
      },
    ],
  });

  const res = await onboarding.ensureOnboardingForContract({
    user: { id: "u1", email: "a@b.co" },
    customer: {},
    subscription: {},
    contractId: "c1",
  });
  assert.equal(res.created, false);
  assert.equal(res.onboarding.id, "ob1");
  // No second record must have been created.
  assert.equal(prisma.subscriptionOnboarding._rows.length, 1);
});

test("noteFlagOffDecision logs at most once per contract and reports the PENDING count (FR-31)", async () => {
  resetPrisma({
    subscriptionOnboarding: [
      { id: "ob1", subscriptionContractId: "c1", status: "PENDING", firstAssignmentTriggered: false },
      { id: "ob2", subscriptionContractId: "c2", status: "PENDING", firstAssignmentTriggered: false },
    ],
  });
  onboarding._resetFlagOffDecisionLog();

  const first = await onboarding.noteFlagOffDecision("c1");
  assert.deepEqual(first, { logged: true, pendingCount: 2 });

  const dup = await onboarding.noteFlagOffDecision("c1");
  assert.equal(dup.logged, false, "same contract is not logged twice");

  const other = await onboarding.noteFlagOffDecision("c2");
  assert.equal(other.logged, true, "a different contract logs its own decision");
});

test("markOnboardingCompleteByAdmin refuses with no confirmed changes and no note, but succeeds with a staff note (FR-29)", async () => {
  resetPrisma({
    subscriptionOnboarding: [
      {
        id: "ob1",
        subscriptionContractId: "c1",
        userId: "u1",
        status: "PENDING",
        completedAt: null,
      },
    ],
  });

  await assert.rejects(
    () => onboarding.markOnboardingCompleteByAdmin({ onboardingId: "ob1", staff: { id: "s1" } }),
    /no confirmed ownership changes/i,
    "must refuse when there are no confirmed changes and no staff note"
  );

  const updated = await onboarding.markOnboardingCompleteByAdmin({
    onboardingId: "ob1",
    staff: { id: "s1", email: "staff@lu.co" },
    staffNote: "Confirmed by phone — subscriber owns nothing yet.",
  });
  assert.equal(updated.status, "COMPLETE");
  assert.match(updated.staffNote, /Confirmed by phone/);
});

test("recordRejection is idempotent and recordOwnership supersedes the active rejection (FR-6)", async () => {
  resetPrisma({});

  await provenance.recordRejection("u1", "Fe", "10mm_cube", "c1");
  await provenance.recordRejection("u1", "Fe", "10mm_cube", "c1");

  let active = await provenance.getActiveRejections("u1");
  assert.equal(active.size, 1, "two rejections of the same unit → exactly one active row");
  assert.ok(active.has("fe|10mm_cube"));

  await provenance.recordOwnership("u1", "Fe", "10mm_cube", { state: "OWNED", contractId: "c1" });

  active = await provenance.getActiveRejections("u1");
  assert.equal(active.size, 0, "confirming ownership supersedes the active rejection");
});

test("write path persists EVERY confirmed format as an ElementSample without overwriting the primary (FR-1/FR-2)", async () => {
  resetPrisma({});

  // Same element, two physical formats — the FRD's 10mm-vs-25.4mm cube example.
  await provenance.recordOwnership("u1", "Fe", "10mm_cube", { state: "OWNED", contractId: "c1" });
  await provenance.recordOwnership("u1", "Fe", "25.4mm_cube", { state: "OWNED", contractId: "c1" });

  // Exactly ONE CollectionItem anchor for the element…
  const items = await prisma.collectionItem.findMany({ where: { userId: "u1", elementSymbol: "Fe" } });
  assert.equal(items.length, 1, "one CollectionItem row per element");
  assert.equal(items[0].format, "10mm_cube", "primary format is NOT overwritten by the second confirmation");

  // …and TWO ElementSample children, one per confirmed format (no data loss).
  const samples = await prisma.elementSample.findMany({ where: { userId: "u1", elementSymbol: "Fe" } });
  const sampleFormats = samples.map((s) => s.format).sort();
  assert.deepEqual(sampleFormats, ["10mm_cube", "25.4mm_cube"]);

  // Read + write now align: both formats are excluded from assignment.
  const allProducts = [
    { id: "p1", elementSymbol: "Fe", sku: "fe_10mm" },   // → 10mm_cube
    { id: "p2", elementSymbol: "Fe", sku: "fe_25.4mm" }, // → 25.4mm_cube
    { id: "p3", elementSymbol: "Au", sku: "au_10mm" },   // not owned
  ];
  const excluded = await manager.computeOnboardingExclusions("u1", allProducts, { confirmedOnly: false });
  assert.deepEqual(excluded.sort(), ["p1", "p2"], "both owned formats excluded; unowned element still eligible");
});

test("ElementSample creation is idempotent — re-confirming the same format does not duplicate", async () => {
  resetPrisma({});

  await provenance.recordOwnership("u1", "Au", "10mm_cube", { state: "OWNED", contractId: "c1" });
  await provenance.recordOwnership("u1", "Au", "10mm_cube", { state: "OWNED", contractId: "c1" });

  const samples = await prisma.elementSample.findMany({ where: { userId: "u1", elementSymbol: "Au" } });
  assert.equal(samples.length, 1, "same (element, format) confirmed twice → exactly one sample");
});

test("cross-webhook first-shipment claim: only one of two racing webhooks wins (FR-16/FR-17)", async () => {
  // Both subscription/created and billing_attempt/succeeded ensure the SAME
  // onboarding record, then race on the atomic claim. Exactly one may assign.
  resetPrisma({
    subscriptionOnboarding: [
      { id: "ob1", subscriptionContractId: "c1", userId: "u1", status: "COMPLETE", firstAssignmentTriggered: false },
    ],
  });

  const first = await onboarding.claimFirstAssignment("c1");
  const second = await onboarding.claimFirstAssignment("c1");

  assert.equal(first, true, "the first webhook to claim wins and assigns");
  assert.equal(second, false, "the sibling webhook loses the claim and must NOT double-ship");

  const row = await prisma.subscriptionOnboarding.findUnique({ where: { id: "ob1" } });
  assert.equal(row.firstAssignmentTriggered, true, "claim is persisted as a check-and-set");
});
