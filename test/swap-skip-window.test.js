/**
 * Regression tests — Subscription Swap & Skip Window (feature_swap_skip_window).
 *
 * These exercise the server-side logic that has no HTTP/UI surface and encodes
 * the FRD v1.2 correctness invariants:
 *   - The single atomic finalization claim — a held shipment can never be
 *     finalized twice (FR-15).
 *   - Type-AGNOSTIC skip-credit idempotency: a skip must detect a carry-forward
 *     already banked for the same (contract, cycle) and never double-credit or
 *     collide at the DB level (FR-12).
 *   - Window eligibility gating for first / backstop shipments (FR-3).
 *   - Non-destructive pause/resume of held shipments (FR-17 / FR-32).
 *   - Cancellation NEVER auto-ships a held shipment; it banks store credit (no
 *     refund) and stamps the 90-day post-cancellation expiry (FR-18).
 *   - Idempotent, balance-capped skip-credit expiry sweep.
 *   - Swap pool = engine pool capped at the original's retail, current excluded
 *     (FR-5 / FR-6 / FR-34).
 *   - Window-close job finalizes due shipments and is idempotent (FR-13).
 *
 * The prisma client is replaced with an in-memory fake via mock.module. credits
 * and the assignment engine are kept REAL (they run against the fake prisma / are
 * pure); subscription-manager, subscription-tiers, and notifications are stubbed.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";

/* ─────────────────────────── in-memory fake prisma ─────────────────────────── */

function cmp(op, a, b) {
  const av = a instanceof Date ? a.getTime() : a;
  const bv = b instanceof Date ? b.getTime() : b;
  if (op === "gt") return av > bv;
  if (op === "gte") return av >= bv;
  if (op === "lt") return av < bv;
  if (op === "lte") return av <= bv;
  return false;
}

/** Does a row satisfy a prisma-style `where` clause (the subset we rely on)? */
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
    if (cond instanceof Date) {
      const rv = row[key] instanceof Date ? row[key].getTime() : row[key];
      if (rv !== cond.getTime()) return false;
      continue;
    }
    if (cond && typeof cond === "object" && !Array.isArray(cond)) {
      for (const [op, val] of Object.entries(cond)) {
        if (op === "in") {
          if (!val.includes(row[key])) return false;
        } else if (op === "not") {
          if (val === null) {
            if (row[key] === null || row[key] === undefined) return false;
          } else if (row[key] === val) {
            return false;
          }
        } else if (["gt", "gte", "lt", "lte"].includes(op)) {
          if (row[key] === null || row[key] === undefined) return false;
          if (!cmp(op, row[key], val)) return false;
        }
      }
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
    async findMany({ where, orderBy, take } = {}) {
      let out = rows.filter((r) => matchWhere(r, where)).map((r) => ({ ...r }));
      if (orderBy) {
        const [field, dir] = Object.entries(orderBy)[0];
        out.sort((a, b) => {
          const av = a[field] instanceof Date ? a[field].getTime() : a[field];
          const bv = b[field] instanceof Date ? b[field].getTime() : b[field];
          if (av < bv) return dir === "desc" ? 1 : -1;
          if (av > bv) return dir === "desc" ? -1 : 1;
          return 0;
        });
      }
      if (typeof take === "number") out = out.slice(0, take);
      return out;
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
    async deleteMany({ where } = {}) {
      let count = 0;
      for (let i = rows.length - 1; i >= 0; i--) {
        if (matchWhere(rows[i], where)) {
          rows.splice(i, 1);
          count += 1;
        }
      }
      return { count };
    },
  };
}

/**
 * A single, STABLE prisma object is mocked once for the whole file; `resetPrisma`
 * repopulates the SAME object's models in place between tests so each test starts
 * from clean, isolated state. `$transaction` runs the (already-issued) fake
 * operation promises — the fake models execute eagerly, so Promise.all suffices.
 */
const prisma = {
  subscriptionShipment: makeModel("subscriptionShipment"),
  shipmentItem: makeModel("shipmentItem"),
  shipmentSwapEvent: makeModel("shipmentSwapEvent"),
  subscription: makeModel("subscription"),
  customer: makeModel("customer"),
  product: makeModel("product"),
  creditTransaction: makeModel("creditTransaction"),
  user: makeModel("user"),
  swapWindowSettings: makeModel("swapWindowSettings"),
  swapWindowSettingsAudit: makeModel("swapWindowSettingsAudit"),
  async $transaction(ops) {
    return Promise.all(ops);
  },
};

function resetPrisma(seeds = {}) {
  for (const name of Object.keys(prisma)) {
    if (!prisma[name] || !prisma[name]._rows) continue;
    const rows = prisma[name]._rows;
    rows.length = 0;
    for (const r of seeds[name] || []) rows.push({ ...r });
  }
}

/** Mutable stubs for the lazily-imported subscription-manager / tiers modules. */
const smStubs = {
  finalizeShipment: async () => ({ draftOrder: { id: "draft_default" }, error: null }),
  openException: async () => ({ id: "exc_default" }),
  resolveUserIdForCustomer: async (c) => c?.userId ?? "u1",
  loadAssignmentContext: async () => ({
    ownedProductIds: [],
    shippedProductIds: [],
    preferences: {},
    allProducts: [],
  }),
  tier: { excludePreciousMetals: false, requireSubscriptionEligible: false },
};

mock.module("../app/lib/db.server.js", { namedExports: { prisma } });
mock.module("../app/lib/notifications-db.server.js", {
  namedExports: { notify: async () => ({ id: "notif" }) },
});
mock.module("../app/lib/subscription-manager.server.js", {
  namedExports: {
    finalizeShipment: (...a) => smStubs.finalizeShipment(...a),
    openException: (...a) => smStubs.openException(...a),
    resolveUserIdForCustomer: (...a) => smStubs.resolveUserIdForCustomer(...a),
    loadAssignmentContext: (...a) => smStubs.loadAssignmentContext(...a),
  },
});
mock.module("../app/lib/subscription-tiers-db.server.js", {
  namedExports: { getTierByCollectionType: async () => smStubs.tier },
});

const swap = await import("../app/lib/swap-window.server.js");
const credits = await import("../app/lib/credits.server.js");

const { HELD_STATUS, SWAP_DECISION, DEFAULT_SWAP_WINDOW_SETTINGS } = swap;

/* ─────────────────────────────────── tests ─────────────────────────────────── */

test("claimFinalization is an atomic single-winner: first caller wins, second loses (FR-15)", async () => {
  resetPrisma({
    subscriptionShipment: [
      { id: "sh1", status: HELD_STATUS, finalizationClaimed: false, swapDecision: "NONE" },
    ],
  });

  assert.equal(await swap.claimFinalization("sh1"), true, "first claim wins");
  assert.equal(await swap.claimFinalization("sh1"), false, "second claim loses");

  const row = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  assert.equal(row.finalizationClaimed, true, "claim is persisted as a check-and-set");
});

test("grantSkipCredit is type-AGNOSTIC: a carry-forward already banked for the cycle blocks a double credit (FR-12)", async () => {
  resetPrisma({
    user: [{ id: "u1", storeCreditBalance: 0 }],
    creditTransaction: [
      {
        id: "ct1",
        userId: "u1",
        subscriptionContractId: "c1",
        billingCycle: "2026-08",
        type: "SUBSCRIPTION_CARRYFORWARD",
        amount: 20,
      },
    ],
  });

  const res = await credits.grantSkipCredit("u1", "c1", "2026-08", 25, "skip cycle");
  assert.equal(res.wasAlreadyGranted, true, "detects the existing row for this (contract, cycle)");
  assert.equal(res.collidedType, "SUBSCRIPTION_CARRYFORWARD", "reports the colliding type");
  assert.equal(res.balance, 0, "balance is NOT changed");
  assert.equal(prisma.creditTransaction._rows.length, 1, "no second ledger row is created");
});

test("grantSkipCredit banks a fresh skip credit with the given expiry when the cycle is clean", async () => {
  resetPrisma({ user: [{ id: "u1", storeCreditBalance: 10 }] });

  const expiresAt = new Date("2026-12-01T00:00:00Z");
  const res = await credits.grantSkipCredit("u1", "c1", "2026-08", 45, "skip cycle", { expiresAt });
  assert.equal(res.wasAlreadyGranted, false);
  assert.equal(res.balance, 55, "amount is added to the pooled balance");

  const row = prisma.creditTransaction._rows[0];
  assert.equal(row.type, "SUBSCRIPTION_SKIP_CREDIT");
  assert.equal(row.amount, 45);
  assert.equal(row.expiresAt.getTime(), expiresAt.getTime(), "expiry is stored");
});

test("shipmentIsWindowEligible gates first-shipment and backstop assignments per settings (FR-3)", () => {
  const on = { firstShipmentGetsWindow: true, backstopAssignmentGetsWindow: true };
  const firstOff = { firstShipmentGetsWindow: false, backstopAssignmentGetsWindow: true };
  const backstopOff = { firstShipmentGetsWindow: true, backstopAssignmentGetsWindow: false };

  assert.equal(swap.shipmentIsWindowEligible({ isFirstShipment: true, settings: firstOff }), false);
  assert.equal(swap.shipmentIsWindowEligible({ isFirstShipment: true, settings: on }), true);
  assert.equal(
    swap.shipmentIsWindowEligible({ gateMode: "BACKSTOP_ONLY", settings: backstopOff }),
    false
  );
  assert.equal(swap.shipmentIsWindowEligible({ gateMode: "BACKSTOP_ONLY", settings: on }), true);
  assert.equal(swap.shipmentIsWindowEligible({ isFirstShipment: false, settings: on }), true);
});

test("pauseHeldShipments captures remaining window time and LEAVES the shipment held (FR-17/FR-32)", async () => {
  const now = new Date("2026-08-14T00:00:00Z");
  const windowExpiresAt = new Date(now.getTime() + 3 * 86400000); // 3 days out
  resetPrisma({
    subscriptionShipment: [
      {
        id: "sh1",
        subscriptionId: "sub1",
        status: HELD_STATUS,
        finalizationClaimed: false,
        windowExpiresAt,
        windowRemainingSeconds: null,
      },
    ],
  });

  const res = await swap.pauseHeldShipments("sub1", { now });
  assert.equal(res.paused, 1);

  const row = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  assert.equal(row.status, HELD_STATUS, "still held — never swept to skipped");
  assert.equal(row.windowRemainingSeconds, 3 * 86400, "captured exactly 3 days of remaining window");

  const events = await prisma.shipmentSwapEvent.findMany({ where: { shipmentId: "sh1" } });
  assert.ok(events.some((e) => e.action === "PAUSED"), "a PAUSED event is recorded");

  // Double pause must not clobber the earlier capture.
  const again = await swap.pauseHeldShipments("sub1", { now: new Date(now.getTime() + 86400000) });
  assert.equal(again.paused, 0, "already-captured shipment is not re-paused");
  const row2 = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  assert.equal(row2.windowRemainingSeconds, 3 * 86400, "original capture is preserved");
});

test("resumeHeldShipments recomputes the deadline from captured time and clears the capture (FR-17)", async () => {
  const now = new Date("2026-08-20T00:00:00Z");
  resetPrisma({
    subscriptionShipment: [
      {
        id: "sh1",
        subscriptionId: "sub1",
        status: HELD_STATUS,
        finalizationClaimed: false,
        windowExpiresAt: new Date("2026-08-01T00:00:00Z"), // stale
        windowRemainingSeconds: 3600, // 1 hour banked
      },
    ],
  });

  const res = await swap.resumeHeldShipments("sub1", { now });
  assert.equal(res.resumed, 1);

  const row = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  assert.equal(row.windowRemainingSeconds, null, "capture is cleared");
  assert.equal(
    row.windowExpiresAt.getTime(),
    now.getTime() + 3600 * 1000,
    "deadline is now + captured remaining seconds"
  );
});

test("handleCancelledHeldShipments never finalizes — it banks credit (no refund) and stamps the 90-day expiry (FR-18)", async () => {
  // Prove no finalization happens: if the code tried to place an order this throws.
  smStubs.finalizeShipment = async () => {
    throw new Error("cancellation must NOT finalize a held shipment");
  };
  smStubs.resolveUserIdForCustomer = async () => "u1";

  const now = new Date("2026-08-14T00:00:00Z");
  resetPrisma({
    subscription: [
      { id: "sub1", customerId: "cust1", appstleContractId: "c1", priceUsd: 45, nextBillingDate: "2026-08-01" },
    ],
    customer: [{ id: "cust1", email: "a@b.co" }],
    user: [{ id: "u1", storeCreditBalance: 0 }],
    subscriptionShipment: [
      {
        id: "sh1",
        subscriptionId: "sub1",
        customerId: "cust1",
        status: HELD_STATUS,
        finalizationClaimed: false,
        swapDecision: "NONE",
        assignedPrice: 45,
      },
    ],
  });

  const res = await swap.handleCancelledHeldShipments({
    subscription: prisma.subscription._rows[0],
    settings: { ...DEFAULT_SWAP_WINDOW_SETTINGS },
    now,
  });

  assert.equal(res.held, 1);
  assert.equal(res.credited, 1, "cycle value banked as store credit");
  assert.equal(res.refunded, false, "no cash refund (policy off)");
  assert.equal(res.expiryStamped, 1, "the banked skip credit gets the post-cancellation expiry");

  const shipment = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  assert.equal(shipment.status, "skipped", "held shipment resolved to skipped, not shipped");
  assert.equal(shipment.finalizationClaimed, true);

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.storeCreditBalance, 45, "subscriber credited the cycle value");

  const credit = prisma.creditTransaction._rows.find((r) => r.type === "SUBSCRIPTION_SKIP_CREDIT");
  assert.ok(credit, "a skip credit ledger row exists");
  const expected = new Date(now.getTime() + 90 * 86400000);
  assert.equal(credit.expiresAt.getTime(), expected.getTime(), "expiry is now + 90 days");

  smStubs.finalizeShipment = async () => ({ draftOrder: { id: "draft_default" }, error: null }); // restore
});

test("runSkipCreditExpirySweep claws back capped at balance and is idempotent (no double claw-back)", async () => {
  const now = new Date("2026-11-01T00:00:00Z");
  resetPrisma({
    user: [{ id: "u1", storeCreditBalance: 30 }], // less than the credit amount
    creditTransaction: [
      {
        id: "ct1",
        userId: "u1",
        type: "SUBSCRIPTION_SKIP_CREDIT",
        amount: 50,
        expiredAt: null,
        expiresAt: new Date("2026-10-01T00:00:00Z"), // already past
        billingCycle: "2026-08",
      },
    ],
  });

  const first = await credits.runSkipCreditExpirySweep({ now });
  assert.equal(first.scanned, 1);
  assert.equal(first.expired, 1);
  assert.equal(first.clawedBack, 30, "claw-back is capped at the current balance, never negative");

  const user = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(user.storeCreditBalance, 0, "balance floored at zero");

  const claimed = prisma.creditTransaction._rows.find((r) => r.id === "ct1");
  assert.ok(claimed.expiredAt, "the credit is stamped expired so it is never swept again");

  const second = await credits.runSkipCreditExpirySweep({ now });
  assert.equal(second.scanned, 0, "re-run finds nothing — idempotent");
  assert.equal(second.clawedBack, 0, "no double claw-back");

  const userAfter = await prisma.user.findUnique({ where: { id: "u1" } });
  assert.equal(userAfter.storeCreditBalance, 0);
});

test("computeSwapPool = engine pool capped at the original's retail, current item excluded (FR-5/FR-6/FR-34)", async () => {
  smStubs.tier = { excludePreciousMetals: false, requireSubscriptionEligible: false };
  const allProducts = [
    { id: "pOrig", status: "Active", inventoryQty: 3, retailPrice: 100, priceUsd: 100, collectionTypes: ["lucite"], elementSymbol: "Fe", title: "Iron" },
    { id: "pCheap", status: "Active", inventoryQty: 3, retailPrice: 50, priceUsd: 50, collectionTypes: ["lucite"], elementSymbol: "Cu", title: "Copper" },
    { id: "pEqual", status: "Active", inventoryQty: 3, retailPrice: 100, priceUsd: 100, collectionTypes: ["lucite"], elementSymbol: "Ni", title: "Nickel" },
    { id: "pExpensive", status: "Active", inventoryQty: 3, retailPrice: 150, priceUsd: 150, collectionTypes: ["lucite"], elementSymbol: "Co", title: "Cobalt" },
  ];
  smStubs.loadAssignmentContext = async () => ({
    ownedProductIds: [],
    shippedProductIds: [],
    preferences: {},
    allProducts,
  });

  resetPrisma({
    subscription: [{ id: "sub1", customerId: "cust1", collectionType: "lucite" }],
    customer: [{ id: "cust1", collectionType: "lucite", firstName: "A", lastName: "B" }],
    subscriptionShipment: [
      { id: "sh1", subscriptionId: "sub1", customerId: "cust1", status: HELD_STATUS, originalProductId: "pOrig" },
    ],
    shipmentItem: [{ id: "si1", shipmentId: "sh1", productId: "pOrig" }],
    product: allProducts,
  });

  const shipment = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  const { candidates, originalRetail, currentProductId } = await swap.computeSwapPool({ shipment });

  assert.equal(originalRetail, 100, "cap is the original item's retail value");
  assert.equal(currentProductId, "pOrig");
  const ids = candidates.map((c) => c.id).sort();
  assert.deepEqual(ids, ["pCheap", "pEqual"], "≤ original retail and current item excluded; pricier item dropped");
});

test("runSwapWindowCloseJob finalizes a due held shipment and is idempotent on re-run (FR-13)", async () => {
  smStubs.finalizeShipment = async () => ({ draftOrder: { id: "d1" }, error: null });
  smStubs.openException = async () => ({ id: "e1" });

  const now = new Date("2026-08-20T00:00:00Z");
  resetPrisma({
    subscription: [{ id: "sub1", customerId: "cust1", priceUsd: 45 }],
    customer: [{ id: "cust1" }],
    product: [
      { id: "pOrig", status: "Active", inventoryQty: 5, retailPrice: 45, priceUsd: 45, title: "Iron", sku: "fe" },
    ],
    subscriptionShipment: [
      {
        id: "sh1",
        subscriptionId: "sub1",
        customerId: "cust1",
        status: HELD_STATUS,
        finalizationClaimed: false,
        swapDecision: "NONE",
        originalProductId: "pOrig",
        assignedPrice: 45,
        windowExpiresAt: new Date("2026-08-19T00:00:00Z"), // already elapsed
      },
    ],
    shipmentItem: [{ id: "si1", shipmentId: "sh1", productId: "pOrig" }],
  });

  const summary = await swap.runSwapWindowCloseJob({ now });
  assert.equal(summary.scanned, 1);
  assert.equal(summary.finalized, 1, "the due shipment is shipped");
  assert.equal(summary.exceptions, 0);

  const shipment = await prisma.subscriptionShipment.findUnique({ where: { id: "sh1" } });
  assert.equal(shipment.finalizationClaimed, true);

  const rerun = await swap.runSwapWindowCloseJob({ now });
  assert.equal(rerun.scanned, 0, "already-finalized shipment is not picked up again — idempotent");
});
