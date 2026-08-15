/**
 * Admin Swap & Skip Window Operations — /app/admin/swap-window
 *
 * Staff control center for the subscription Swap & Skip Window feature. Shows
 * held-shipment counts and what the window-close job and credit-expiry sweep
 * would do right now, and lets staff run each on demand (FR-22).
 *
 * Prototype note: in production these jobs run on a schedule (cron). Per the FRD
 * acceptance criteria, auto-ship-on-window-close is admin/cron-triggered — not
 * automatic — until a real scheduler exists. Both jobs are idempotent.
 *
 * The settings panel, audit trail, and per-shipment history live on the same
 * admin surface (see the Settings section below and app.admin.swap-window.*).
 */
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, useNavigation } from "@remix-run/react";
import { requireAdmin } from "../lib/admin.server.js";
import { prisma } from "../lib/db.server.js";
import { getFeatureFlag } from "../lib/feature-flags.server.js";
import {
  SWAP_WINDOW_FLAG,
  HELD_STATUS,
  runSwapWindowCloseJob,
  getSwapWindowSettings,
} from "../lib/swap-window.server.js";
import { runSkipCreditExpirySweep } from "../lib/credits.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const now = new Date();

  const [flagEnabled, settings, held, dueClose, dueExpiry] = await Promise.all([
    getFeatureFlag(SWAP_WINDOW_FLAG),
    getSwapWindowSettings(),
    prisma.subscriptionShipment.count({ where: { status: HELD_STATUS } }),
    prisma.subscriptionShipment.count({
      where: { status: HELD_STATUS, finalizationClaimed: false, windowExpiresAt: { not: null, lte: now } },
    }),
    prisma.creditTransaction.count({
      where: {
        type: "SUBSCRIPTION_SKIP_CREDIT",
        expiredAt: null,
        amount: { gt: 0 },
        expiresAt: { not: null, lte: now },
      },
    }),
  ]);

  return json({
    flagEnabled: !!flagEnabled,
    windowLengthDays: settings.windowLengthDays,
    held,
    due: { close: dueClose, expiry: dueExpiry },
  });
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "run-close-job") {
    try {
      const summary = await runSwapWindowCloseJob();
      return json({ ok: true, kind: "close", summary });
    } catch (e) {
      return json({ error: e.message || "Window-close job failed." }, { status: 500 });
    }
  }

  if (intent === "run-expiry-sweep") {
    try {
      const summary = await runSkipCreditExpirySweep();
      return json({ ok: true, kind: "expiry", summary });
    } catch (e) {
      return json({ error: e.message || "Credit-expiry sweep failed." }, { status: 500 });
    }
  }

  return json({ error: "Unknown action." }, { status: 400 });
};

export default function AdminSwapWindow() {
  const { flagEnabled, windowLengthDays, held, due } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const runningClose = nav.state !== "idle" && nav.formData?.get("intent") === "run-close-job";
  const runningExpiry = nav.state !== "idle" && nav.formData?.get("intent") === "run-expiry-sweep";

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Swap &amp; Skip Window Operations</h2>
          <p style={styles.subtitle}>
            Window length: {windowLengthDays} days.{" "}
            <span style={{ color: flagEnabled ? "#059669" : "#b45309", fontWeight: 600 }}>
              Feature {flagEnabled ? "ON" : "OFF"}
            </span>
            {!flagEnabled && " — assignments finalize immediately; no held state is created."}
          </p>
        </div>
        <Link to="/app/admin/swap-window/settings" style={styles.settingsLink}>
          ⚙️ Settings &amp; history
        </Link>
      </div>

      {/* Status counts */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#2563eb" }}>{held}</span>
          <span style={styles.statLabel}>Shipments held</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#dc2626" }}>{due.close}</span>
          <span style={styles.statLabel}>Windows due to close</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#b45309" }}>{due.expiry}</span>
          <span style={styles.statLabel}>Credits due to expire</span>
        </div>
      </div>

      {/* Window-close job */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>🕐 Window-close job</h3>
        </div>
        <div style={styles.cardBody}>
          <p style={styles.jobDesc}>
            Finalizes every held shipment whose window has elapsed — placing the order for the
            customer's current pick (original or swapped). Running is idempotent and race-safe:
            a shipment can never be finalized twice.
          </p>
          {actionData?.ok && actionData.kind === "close" && actionData.summary && (
            <div style={styles.noticeOk}>
              Close job complete — scanned {actionData.summary.scanned}, finalized{" "}
              {actionData.summary.finalized}, {actionData.summary.exceptions} exception(s),{" "}
              {actionData.summary.skippedRace} already-decided
              {actionData.summary.errors > 0 ? `, ${actionData.summary.errors} error(s)` : ""}.
            </div>
          )}
          {actionData?.error && !actionData?.kind && <div style={styles.noticeErr}>{actionData.error}</div>}
          <Form method="post">
            <input type="hidden" name="intent" value="run-close-job" />
            <button type="submit" style={{ ...styles.runBtn, opacity: runningClose ? 0.6 : 1 }} disabled={runningClose}>
              {runningClose ? "Running…" : `Run window-close job${due.close > 0 ? ` (${due.close} due)` : ""}`}
            </button>
          </Form>
        </div>
      </div>

      {/* Credit-expiry sweep */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>💳 Skip-credit expiry sweep</h3>
        </div>
        <div style={styles.cardBody}>
          <p style={styles.jobDesc}>
            Claws back the remaining value of skip credits whose expiry has passed (e.g. 90 days
            after cancellation). Idempotent — a credit is never expired twice, and a claw-back can
            never push a balance negative.
          </p>
          {actionData?.ok && actionData.kind === "expiry" && actionData.summary && (
            <div style={styles.noticeOk}>
              Sweep complete — scanned {actionData.summary.scanned}, expired {actionData.summary.expired},
              clawed back ${Number(actionData.summary.clawedBack || 0).toFixed(2)}
              {actionData.summary.errors > 0 ? `, ${actionData.summary.errors} error(s)` : ""}.
            </div>
          )}
          <Form method="post">
            <input type="hidden" name="intent" value="run-expiry-sweep" />
            <button type="submit" style={{ ...styles.runBtnAlt, opacity: runningExpiry ? 0.6 : 1 }} disabled={runningExpiry}>
              {runningExpiry ? "Running…" : `Run expiry sweep${due.expiry > 0 ? ` (${due.expiry} due)` : ""}`}
            </button>
          </Form>
        </div>
      </div>

      <div style={styles.footerLink}>
        <Link to="/app/admin/subscription-assignments" style={styles.link}>View subscription assignments →</Link>
      </div>
    </div>
  );
}

const styles = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20, gap: 16 },
  title: { fontSize: 20, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: 0 },
  subtitle: { fontSize: 13, color: "var(--luc-text-muted, #666)", margin: "4px 0 0" },
  settingsLink: {
    color: "var(--luc-accent, #2563eb)", textDecoration: "none", fontSize: 13, fontWeight: 600,
    whiteSpace: "nowrap", border: "1px solid var(--luc-border, #e0e0e0)", borderRadius: 8, padding: "8px 12px",
  },
  statsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 14, marginBottom: 20 },
  statCard: {
    background: "#fff", border: "1px solid var(--luc-border, #e0e0e0)", borderRadius: 10, padding: "16px 18px",
    display: "flex", flexDirection: "column", gap: 4, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  statValue: { fontSize: 26, fontWeight: 800 },
  statLabel: { fontSize: 12, color: "var(--luc-text-muted, #888)", textTransform: "uppercase", letterSpacing: "0.03em" },
  card: {
    background: "#fff", borderRadius: 10, border: "1px solid var(--luc-border, #e0e0e0)", overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)", marginBottom: 20,
  },
  cardHeader: { padding: "14px 18px 10px", borderBottom: "1px solid var(--luc-border, #e0e0e0)" },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: 0 },
  cardBody: { padding: 18 },
  jobDesc: { fontSize: 13, color: "var(--luc-text-muted, #666)", lineHeight: 1.5, margin: "0 0 16px" },
  runBtn: {
    background: "var(--luc-accent, #2563eb)", color: "#fff", border: "none", borderRadius: 8,
    padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  runBtnAlt: {
    background: "#b45309", color: "#fff", border: "none", borderRadius: 8,
    padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  noticeOk: { background: "#dcfce7", color: "#059669", fontSize: 13, padding: "10px 12px", borderRadius: 8, marginBottom: 14 },
  noticeErr: { background: "#fee2e2", color: "#dc2626", fontSize: 13, padding: "10px 12px", borderRadius: 8, marginBottom: 14 },
  footerLink: { marginTop: 4 },
  link: { color: "var(--luc-accent, #2563eb)", textDecoration: "none", fontSize: 13, fontWeight: 500 },
};
