/**
 * Admin Onboarding Operations — /app/admin/onboarding
 *
 * Staff control center for the subscription owned-items onboarding grace window
 * (FR-22, FR-24). Shows onboarding status counts and what the grace job would do
 * right now, and lets staff run the grace job on demand.
 *
 * Prototype note: in production the grace job runs on a schedule (cron). Here it
 * is an admin-triggered batch action, mirroring credits.server.js/grantAllMonthlyCredits.
 */
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, useNavigation } from "@remix-run/react";
import { requireAdmin } from "../lib/admin.server.js";
import { prisma } from "../lib/db.server.js";
import {
  runOnboardingGraceJob,
  GRACE_WINDOW_DAYS,
  ONBOARDING_STATUS,
} from "../lib/subscription-onboarding.server.js";

const DAY_MS = 24 * 60 * 60 * 1000;

export const loader = async ({ request }) => {
  await requireAdmin(request);

  const all = await prisma.subscriptionOnboarding.findMany({
    select: { status: true, remindersSent: true, graceExpiresAt: true },
  });

  const counts = { PENDING: 0, COMPLETE: 0, BACKSTOP_ONLY: 0 };
  const now = Date.now();
  const halfWindowMs = (GRACE_WINDOW_DAYS * DAY_MS) / 2;

  // What the grace job would do on the next run.
  let dueBackstop = 0;
  let dueFinalNotice = 0;
  let dueMidpoint = 0;

  for (const ob of all) {
    counts[ob.status] = (counts[ob.status] || 0) + 1;
    if (ob.status !== ONBOARDING_STATUS.PENDING) continue;
    const graceMs = ob.graceExpiresAt.getTime();
    if (now >= graceMs) {
      dueBackstop++;
    } else if (now >= graceMs - DAY_MS) {
      if (ob.remindersSent < 2) dueFinalNotice++;
    } else if (now >= graceMs - halfWindowMs) {
      if (ob.remindersSent < 1) dueMidpoint++;
    }
  }

  return json({
    counts,
    due: { backstop: dueBackstop, finalNotice: dueFinalNotice, midpoint: dueMidpoint },
    graceWindowDays: GRACE_WINDOW_DAYS,
    total: all.length,
  });
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "run-grace-job") {
    try {
      const summary = await runOnboardingGraceJob();
      return json({ ok: true, summary });
    } catch (e) {
      return json({ error: e.message || "Grace job failed." }, { status: 500 });
    }
  }

  return json({ error: "Unknown action." }, { status: 400 });
};

export default function AdminOnboarding() {
  const { counts, due, graceWindowDays, total } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const running = nav.state !== "idle" && nav.formData?.get("intent") === "run-grace-job";

  const totalDue = due.backstop + due.finalNotice + due.midpoint;

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Subscription Onboarding Operations</h2>
          <p style={styles.subtitle}>
            Grace window: {graceWindowDays} days. {total} onboarding record{total !== 1 ? "s" : ""} total.
          </p>
        </div>
      </div>

      {/* Status counts */}
      <div style={styles.statsGrid}>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#b45309" }}>{counts.PENDING || 0}</span>
          <span style={styles.statLabel}>Pending</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#dc2626" }}>{counts.BACKSTOP_ONLY || 0}</span>
          <span style={styles.statLabel}>Backstop only</span>
        </div>
        <div style={styles.statCard}>
          <span style={{ ...styles.statValue, color: "#059669" }}>{counts.COMPLETE || 0}</span>
          <span style={styles.statLabel}>Complete</span>
        </div>
      </div>

      {/* Grace job control */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>🕐 Grace-window job</h3>
        </div>
        <div style={styles.cardBody}>
          <p style={styles.jobDesc}>
            Sends due reminders, transitions expired grace windows to <strong>Backstop only</strong>,
            and emails the transparency notice. Running is idempotent — reminders are never re-sent.
          </p>

          <div style={styles.dueGrid}>
            <div style={styles.dueItem}>
              <span style={styles.dueValue}>{due.midpoint}</span>
              <span style={styles.dueLabel}>Midpoint reminders due</span>
            </div>
            <div style={styles.dueItem}>
              <span style={styles.dueValue}>{due.finalNotice}</span>
              <span style={styles.dueLabel}>Final notices due</span>
            </div>
            <div style={styles.dueItem}>
              <span style={styles.dueValue}>{due.backstop}</span>
              <span style={styles.dueLabel}>Backstop transitions due</span>
            </div>
          </div>

          {actionData?.ok && actionData.summary && (
            <div style={styles.noticeOk}>
              Grace job complete — scanned {actionData.summary.scanned}, sent{" "}
              {actionData.summary.reminder1} midpoint + {actionData.summary.reminder2} final notice
              {actionData.summary.reminder2 !== 1 ? "s" : ""}, {actionData.summary.backstop} backstop
              transition{actionData.summary.backstop !== 1 ? "s" : ""}
              {actionData.summary.errors > 0 ? `, ${actionData.summary.errors} error(s)` : ""}.
            </div>
          )}
          {actionData?.error && <div style={styles.noticeErr}>{actionData.error}</div>}

          <Form method="post">
            <input type="hidden" name="intent" value="run-grace-job" />
            <button type="submit" style={{ ...styles.runBtn, opacity: running ? 0.6 : 1 }} disabled={running}>
              {running ? "Running…" : `Run grace job${totalDue > 0 ? ` (${totalDue} due)` : ""}`}
            </button>
          </Form>
        </div>
      </div>

      <div style={styles.footerLink}>
        <Link to="/app/admin/users" style={styles.link}>View subscribers →</Link>
      </div>
    </div>
  );
}

const styles = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 20, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: 0 },
  subtitle: { fontSize: 13, color: "var(--luc-text-muted, #666)", margin: "4px 0 0" },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: 14,
    marginBottom: 20,
  },
  statCard: {
    background: "#fff",
    border: "1px solid var(--luc-border, #e0e0e0)",
    borderRadius: 10,
    padding: "16px 18px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  statValue: { fontSize: 26, fontWeight: 800 },
  statLabel: { fontSize: 12, color: "var(--luc-text-muted, #888)", textTransform: "uppercase", letterSpacing: "0.03em" },
  card: {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid var(--luc-border, #e0e0e0)",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
    marginBottom: 20,
  },
  cardHeader: { padding: "14px 18px 10px", borderBottom: "1px solid var(--luc-border, #e0e0e0)" },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: 0 },
  cardBody: { padding: 18 },
  jobDesc: { fontSize: 13, color: "var(--luc-text-muted, #666)", lineHeight: 1.5, margin: "0 0 16px" },
  dueGrid: { display: "flex", gap: 24, marginBottom: 18, flexWrap: "wrap" },
  dueItem: { display: "flex", flexDirection: "column", gap: 2 },
  dueValue: { fontSize: 20, fontWeight: 700, color: "var(--luc-text, #1a1a1a)" },
  dueLabel: { fontSize: 11, color: "var(--luc-text-muted, #999)" },
  runBtn: {
    background: "var(--luc-accent, #2563eb)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "10px 18px",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  noticeOk: {
    background: "#dcfce7",
    color: "#059669",
    fontSize: 13,
    padding: "10px 12px",
    borderRadius: 8,
    marginBottom: 14,
  },
  noticeErr: {
    background: "#fee2e2",
    color: "#dc2626",
    fontSize: 13,
    padding: "10px 12px",
    borderRadius: 8,
    marginBottom: 14,
  },
  footerLink: { marginTop: 4 },
  link: { color: "var(--luc-accent, #2563eb)", textDecoration: "none", fontSize: 13, fontWeight: 500 },
};
