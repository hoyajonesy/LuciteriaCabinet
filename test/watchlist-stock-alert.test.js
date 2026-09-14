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
    }),
    sendWatchlistStockEmail({
      to: hgTo,
      backInStock: false,
      elementName: "Mercury",
      elementSymbol: "Hg",
      productTitle: "Mercury 10mm Cube",
      customerName: "Alan",
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
  });

  const email = latestEmailTo(to);
  // Subject and body must both name Phosphorus (resolved from title), never Lead.
  assert.match(email.subject, /Phosphorus \(P\)/);
  assert.match(email.text, /Phosphorus \(P\)/);
  assert.doesNotMatch(email.subject, /Lead|Pb/);
  assert.doesNotMatch(email.text, /Lead|Pb/);
  assert.strictEqual(email.data.displayLabel, "Phosphorus (P)");
});
