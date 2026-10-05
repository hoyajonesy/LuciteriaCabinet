/**
 * FR-6 — Watchlist stock-alert email subject/body consistency.
 *
 * Regression coverage for Bug 6: the alert email subject named one element
 * while the body named another, because the subject was rendered from the
 * element name and the body headline from a different field. These tests lock
 * in the "single source of truth per email" fix and prove that a batch run
 * with multiple elements (Hydrogen + Mercury) produces per-element emails with
 * no cross-contamination.
 *
 * notifications.server.js only imports nodemailer at module load and creates no
 * SMTP transporter unless RESEND_API_KEY is set, so it imports cleanly here and
 * the rendered body is captured on each log entry (notification.text) up-front.
 */
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  sendWatchlistStockEmail,
  renderWatchlistStockBody,
  getNotificationLog,
} from "../app/lib/notifications.server.js";

// Return the single most recent email logged to a given recipient.
function latestEmailTo(to) {
  const all = getNotificationLog().filter((n) => n.channel === "email" && n.to === to);
  return all[all.length - 1];
}

test("single email: subject and body name the same element", async () => {
  const to = "single@example.com";
  await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Hydrogen",
    elementSymbol: "H",
    productTitle: "Hydrogen Gas Ampoule",
    inventoryQty: 4,
    linkUrl: "/app/cabinet/shop?product=hydrogen",
    customerName: "Ada",
    prefs: { watchlistEmailAlerts: true, watchlistEmailBackInStock: true, watchlistEmailOutOfStock: true, mutedUntil: null },
  });

  const email = latestEmailTo(to);
  assert.ok(email, "email should be logged");
  assert.ok(email.text, "body text should be captured on the log entry");

  // Subject and body must both name Hydrogen and neither may mention Mercury.
  assert.match(email.subject, /Hydrogen/);
  assert.match(email.text, /Hydrogen/);
  assert.doesNotMatch(email.subject, /Mercury/);
  assert.doesNotMatch(email.text, /Mercury/);

  // The authoritative label drives BOTH subject and body.
  assert.ok(email.data.displayLabel, "displayLabel present");
  assert.ok(
    email.subject.includes(email.data.displayLabel),
    "subject uses displayLabel"
  );
  assert.ok(
    email.text.includes(email.data.displayLabel),
    "body uses the same displayLabel as the subject"
  );
});

test("batch run: Hydrogen and Mercury dispatched together stay matched (no cross-contamination)", async () => {
  const hTo = "batch-h@example.com";
  const hgTo = "batch-hg@example.com";

  // Simulate two watchlist elements changing status in the same processing run,
  // dispatched concurrently (fire-and-forget style).
  await Promise.all([
    sendWatchlistStockEmail({
      to: hTo,
      backInStock: true,
      elementName: "Hydrogen",
      elementSymbol: "H",
      productTitle: "Hydrogen Gas Ampoule",
      inventoryQty: 7,
      customerName: "Grace",
      prefs: { watchlistEmailAlerts: true, watchlistEmailBackInStock: true, watchlistEmailOutOfStock: true, mutedUntil: null },
    }),
    sendWatchlistStockEmail({
      to: hgTo,
      backInStock: false,
      elementName: "Mercury",
      elementSymbol: "Hg",
      productTitle: "Mercury 10mm Cube",
      customerName: "Alan",
      prefs: { watchlistEmailAlerts: true, watchlistEmailBackInStock: true, watchlistEmailOutOfStock: true, mutedUntil: null },
    }),
  ]);

  const hEmail = latestEmailTo(hTo);
  const hgEmail = latestEmailTo(hgTo);

  // Hydrogen email: subject + body are Hydrogen, and never Mercury.
  assert.match(hEmail.subject, /Hydrogen \(H\)/);
  assert.match(hEmail.text, /Hydrogen \(H\)/);
  assert.doesNotMatch(hEmail.subject, /Mercury|Hg/);
  assert.doesNotMatch(hEmail.text, /Mercury|Hg/);
  assert.match(hEmail.subject, /^Back in stock:/);

  // Mercury email: subject + body are Mercury, and never Hydrogen.
  assert.match(hgEmail.subject, /Mercury \(Hg\)/);
  assert.match(hgEmail.text, /Mercury \(Hg\)/);
  assert.doesNotMatch(hgEmail.subject, /Hydrogen|\(H\)/);
  assert.doesNotMatch(hgEmail.text, /Hydrogen|\(H\)/);
  assert.match(hgEmail.subject, /is now out of stock$/);

  // Each email's subject and body agree on the same authoritative label.
  assert.ok(hEmail.subject.includes(hEmail.data.displayLabel));
  assert.ok(hEmail.text.includes(hEmail.data.displayLabel));
  assert.ok(hgEmail.subject.includes(hgEmail.data.displayLabel));
  assert.ok(hgEmail.text.includes(hgEmail.data.displayLabel));
});

test("renderWatchlistStockBody uses the shared displayLabel, not a re-derived value", () => {
  // Even when productTitle disagrees with the label the subject used, the body
  // headline follows displayLabel — proving a single source of truth.
  const body = renderWatchlistStockBody("watchlist_back_in_stock", {
    customerName: "Lise",
    displayLabel: "Mercury (Hg)",
    productTitle: "SOME UNRELATED TITLE",
    inventoryQty: 1,
  });
  assert.match(body, /Mercury \(Hg\)/);
  assert.doesNotMatch(body, /SOME UNRELATED TITLE/);
  // Singular quantity phrasing.
  assert.match(body, /is currently 1 in stock/);
});

test("out-of-stock body renders the out-of-stock copy from displayLabel", () => {
  const body = renderWatchlistStockBody("watchlist_out_of_stock", {
    customerName: "Marie",
    displayLabel: "Polonium (Po)",
  });
  assert.match(body, /gone out of stock/);
  assert.match(body, /Polonium \(Po\)/);
});

test("FR-6 robustness: displayLabel derived via canonical resolution from productTitle, not from stale elementName", async () => {
  // Simulates the root data problem FR-1 fixed: the DB has elementName="Lead"
  // but productTitle="Phosphorus 10mm Cube". Before FR-6 robustness, the email
  // would trust elementName and say "Lead (Pb)". With canonical resolution, it
  // correctly resolves to Phosphorus from the title (same logic as the shop).
  const to = "canonical@example.com";
  await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Lead", // WRONG (stale/corrupted DB value)
    elementSymbol: "Pb", // WRONG
    productTitle: "Phosphorus 10mm Cube", // CORRECT (the source of truth)
    inventoryQty: 2,
    customerName: "Dmitri",
    prefs: { watchlistEmailAlerts: true, watchlistEmailBackInStock: true, watchlistEmailOutOfStock: true, mutedUntil: null },
  });

  const email = latestEmailTo(to);
  // Subject and body must both name Phosphorus (resolved from title), never Lead.
  assert.match(email.subject, /Phosphorus \(P\)/);
  assert.match(email.text, /Phosphorus \(P\)/);
  assert.doesNotMatch(email.subject, /Lead|Pb/);
  assert.doesNotMatch(email.text, /Lead|Pb/);
  assert.strictEqual(email.data.displayLabel, "Phosphorus (P)");
});


/* ───────────────────────────────────────────────────────────────────────────
 * FR-7 — Preference gate, self-load, and unsubscribe-token coverage.
 *
 * FR-7.6 moved the preference gate INTO sendWatchlistStockEmail so a direct
 * call for an opted-out user always sends nothing, regardless of caller. The
 * gate returns null and logs NOTHING when it blocks, so "no email" is asserted
 * by confirming the recipient has no logged email. Each case uses a unique
 * recipient so parallel history from other tests can't leak in.
 * ────────────────────────────────────────────────────────────────────────── */
import { mock } from "node:test";
import { generateUnsubToken, verifyUnsubToken } from "../app/lib/unsub-token.server.js";
import { evaluateUnsubGet, performUnsubPost } from "../app/lib/unsubscribe.server.js";

test("gate: watchlistEmailAlerts=false blocks the email entirely", async () => {
  const to = "gate-master-off@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Hydrogen",
    elementSymbol: "H",
    productTitle: "Hydrogen Gas Ampoule",
    customerId: "cust-master-off",
    prefs: { watchlistEmailAlerts: false },
  });
  assert.strictEqual(result, null, "gate should short-circuit and return null");
  assert.strictEqual(latestEmailTo(to), undefined, "no email should be logged");
});

test("gate: back-in-stock blocked when watchlistEmailBackInStock=false", async () => {
  const to = "gate-back-off@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Helium",
    elementSymbol: "He",
    productTitle: "Helium Ampoule",
    customerId: "cust-back-off",
    prefs: { watchlistEmailAlerts: true, watchlistEmailBackInStock: false },
  });
  assert.strictEqual(result, null);
  assert.strictEqual(latestEmailTo(to), undefined, "no back-in-stock email");
});

test("gate: out-of-stock blocked when watchlistEmailOutOfStock=false", async () => {
  const to = "gate-out-off@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: false,
    elementName: "Lithium",
    elementSymbol: "Li",
    productTitle: "Lithium Ampoule",
    customerId: "cust-out-off",
    prefs: { watchlistEmailAlerts: true, watchlistEmailOutOfStock: false },
  });
  assert.strictEqual(result, null);
  assert.strictEqual(latestEmailTo(to), undefined, "no out-of-stock email");
});

test("gate: mutedUntil in the future blocks the email", async () => {
  const to = "gate-muted@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Beryllium",
    elementSymbol: "Be",
    productTitle: "Beryllium Ampoule",
    customerId: "cust-muted",
    prefs: {
      watchlistEmailAlerts: true,
      watchlistEmailBackInStock: true,
      mutedUntil: new Date(Date.now() + 60_000),
    },
  });
  assert.strictEqual(result, null);
  assert.strictEqual(latestEmailTo(to), undefined, "no email while muted");
});

test("gate: fully-opted-in prefs let the email through", async () => {
  const to = "gate-allowed@example.com";
  await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Boron",
    elementSymbol: "B",
    productTitle: "Boron Ampoule",
    inventoryQty: 3,
    customerId: "cust-allowed",
    prefs: {
      watchlistEmailAlerts: true,
      watchlistEmailBackInStock: true,
      watchlistEmailOutOfStock: true,
      mutedUntil: null,
    },
  });
  const email = latestEmailTo(to);
  assert.ok(email, "email should be logged when fully opted in");
  assert.match(email.subject, /Boron \(B\)/);
});

test("gate self-load: opted-out prefs loaded via getPreferences block the email", async () => {
  // When the caller passes customerId but no prefs, the gate self-loads them
  // via a dynamic import of notifications-db.server.js. Mock that module so the
  // loaded prefs say the user opted out of email — the email must be blocked.
  const __dbMock = mock.module("../app/lib/notifications-db.server.js", {
    namedExports: {
      getPreferences: async () => ({ watchlistEmailAlerts: false }),
    },
  });

  const to = "gate-selfload-off@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Carbon",
    elementSymbol: "C",
    productTitle: "Carbon Ampoule",
    customerId: "cust-selfload-off",
    // no prefs — forces self-load
  });
  assert.strictEqual(result, null, "self-loaded opt-out should block");
  assert.strictEqual(latestEmailTo(to), undefined, "no email after self-load opt-out");

  __dbMock.restore();
});

test("no customerId and no prefs: email is REFUSED (cannot verify opt-out)", async () => {
  // Must-fix 3: when the function cannot establish the user's preferences at all
  // (no prefs passed AND no customerId to look them up), it must refuse to send
  // rather than risk emailing someone who opted out. Opt-outs win over delivery.
  const to = "no-prefs-refused@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Nitrogen",
    elementSymbol: "N",
    productTitle: "Nitrogen Ampoule",
    inventoryQty: 2,
    // no customerId, no prefs — nothing to verify against
  });
  assert.strictEqual(result, null, "must refuse when opt-out cannot be verified");
  assert.strictEqual(latestEmailTo(to), undefined, "no email when prefs are unknowable");
});

test("gate self-load throws: email is REFUSED (cannot verify opt-out)", async () => {
  // Must-fix 3: if the self-load lookup throws, we refuse to send rather than
  // bypass the user's choice.
  const __dbMock = mock.module("../app/lib/notifications-db.server.js", {
    namedExports: {
      getPreferences: async () => {
        throw new Error("db unavailable");
      },
    },
  });

  const to = "gate-selfload-throws@example.com";
  const result = await sendWatchlistStockEmail({
    to,
    backInStock: true,
    elementName: "Oxygen",
    elementSymbol: "O",
    productTitle: "Oxygen Ampoule",
    customerId: "cust-selfload-throws",
    // no prefs — forces self-load, which throws
  });
  assert.strictEqual(result, null, "must refuse when the prefs lookup throws");
  assert.strictEqual(latestEmailTo(to), undefined, "no email when prefs lookup fails");

  __dbMock.restore();
});

/* ── FR-7.5 — unsubscribe token generate/verify ───────────────────────────── */

test("unsub token: generate produces a 64-char lowercase hex digest", () => {
  process.env.UNSUB_SECRET = "test-unsub-secret";
  const token = generateUnsubToken("user-123");
  assert.match(token, /^[0-9a-f]{64}$/, "token is 64 hex chars");
});

test("unsub token: verify accepts the matching token", () => {
  process.env.UNSUB_SECRET = "test-unsub-secret";
  const token = generateUnsubToken("user-123");
  assert.strictEqual(verifyUnsubToken("user-123", token), true);
});

test("unsub token: verify rejects a token for a different user", () => {
  process.env.UNSUB_SECRET = "test-unsub-secret";
  const token = generateUnsubToken("user-123");
  assert.strictEqual(verifyUnsubToken("user-999", token), false);
});

test("unsub token: verify rejects a wrong-length token without throwing", () => {
  process.env.UNSUB_SECRET = "test-unsub-secret";
  assert.strictEqual(verifyUnsubToken("user-123", "deadbeef"), false);
});

test("unsub token: verify rejects a missing token", () => {
  process.env.UNSUB_SECRET = "test-unsub-secret";
  assert.strictEqual(verifyUnsubToken("user-123", ""), false);
  assert.strictEqual(verifyUnsubToken("user-123", undefined), false);
});


/* ── FR-7.5 — unsubscribe route: GET is read-only, POST mutates ────────────── */

// Helper: build a Request for the unsubscribe route with the given uid/token.
function unsubRequest(uid, token, method = "GET") {
  const base = "https://cabinet.luciteria.com/api/unsubscribe-watchlist";
  const qs = new URLSearchParams();
  if (uid != null) qs.set("uid", uid);
  if (token != null) qs.set("token", token);
  return new Request(`${base}?${qs.toString()}`, { method });
}

test("unsub route: GET with a valid token changes NOTHING (read-only)", async () => {
  process.env.UNSUB_SECRET = "route-secret";
  const token = generateUnsubToken("user-get");
  // evaluateUnsubGet has no mutation path at all — it only validates. A valid
  // token yields a confirm page (valid:true) and never touches the database.
  const result = evaluateUnsubGet(unsubRequest("user-get", token, "GET"));
  assert.strictEqual(result.valid, true, "valid token is recognized");
  assert.strictEqual(result.status, 200);
});

test("unsub route: POST with a bad token is rejected and changes nothing", async () => {
  process.env.UNSUB_SECRET = "route-secret";
  let updateCalls = 0;
  const update = async () => {
    updateCalls += 1;
  };
  const result = await performUnsubPost(
    unsubRequest("user-bad", "deadbeef", "POST"),
    { update }
  );
  assert.ok(result.error, "bad token returns an error");
  assert.strictEqual(result.status, 403);
  assert.strictEqual(updateCalls, 0, "a rejected POST must not mutate");
});

test("unsub route: POST with a valid token turns watchlistEmailAlerts off", async () => {
  process.env.UNSUB_SECRET = "route-secret";
  const calls = [];
  const update = async (uid, data) => {
    calls.push({ uid, data });
  };
  const token = generateUnsubToken("user-ok");
  const result = await performUnsubPost(
    unsubRequest("user-ok", token, "POST"),
    { update }
  );
  assert.deepStrictEqual(result, { ok: true });
  assert.strictEqual(calls.length, 1, "exactly one preference update");
  assert.strictEqual(calls[0].uid, "user-ok");
  assert.deepStrictEqual(
    calls[0].data,
    { watchlistEmailAlerts: false },
    "only watchlistEmailAlerts is turned off"
  );
});
