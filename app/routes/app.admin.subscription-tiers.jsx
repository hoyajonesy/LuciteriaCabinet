/**
 * Admin: Subscription Tier Management — list view.
 *
 * Lists every subscription tier (active + inactive), showing pricing, credit
 * value, allowed formats, subscriber count and status. Admins can add a new
 * tier, edit, activate/deactivate, or delete (blocked when live subscribers
 * are attached). Every change is written to the audit trail.
 *
 * Nested under the /app/admin layout, which enforces the isStaff check and
 * renders the sidebar nav — so this route renders content only.
 */
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Link, Outlet, useLocation } from "@remix-run/react";
import { getUserId } from "../lib/session.server.js";
import { prisma } from "../lib/db.server.js";
import {
  listAllTiersForAdmin,
  getRecentTierAudit,
  setTierActive,
  deleteTier,
} from "../lib/tier-admin.server.js";
import TierCard from "../components/tier/TierCard.jsx";
import { auditActionLabel } from "../components/tier/tier-form-helpers.js";

export async function loader() {
  const [tiers, audit] = await Promise.all([listAllTiersForAdmin(), getRecentTierAudit(15)]);
  return json({ tiers, audit });
}

export async function action({ request }) {
  const userId = await getUserId(request);
  const admin = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    : null;
  const actorEmail = admin?.email || "admin";

  const form = await request.formData();
  const intent = form.get("intent");
  const tierId = form.get("tierId");

  try {
    if (intent === "toggle") {
      const isActive = form.get("isActive") === "true";
      const t = await setTierActive(tierId, isActive, { userId, actorEmail });
      return json({ success: `Tier "${t.displayName}" ${isActive ? "activated" : "deactivated"}.` });
    }

    if (intent === "delete") {
      const result = await deleteTier(tierId, { userId, actorEmail });
      if (result.blocked) {
        return json(
          { error: `Cannot delete — ${result.activeSubscribers} active subscriber(s). Deactivate the tier instead.` },
          { status: 400 },
        );
      }
      return json({ success: "Tier deleted." });
    }

    return json({ error: `Unknown action: ${intent}` }, { status: 400 });
  } catch (err) {
    return json({ error: err.message || "Action failed." }, { status: 500 });
  }
}

export default function SubscriptionTiers() {
  const { tiers, audit } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const location = useLocation();
  const busy = nav.state !== "idle";

  const activeCount = tiers.filter((t) => t.isActive).length;

  // When a child route (create / edit form) is active, show only that form.
  const path = location.pathname.replace(/\/$/, "");
  const isChildActive = path !== "/app/admin/subscription-tiers";
  if (isChildActive) {
    return <Outlet />;
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.h2}>Subscription Tiers</h2>
          <p style={styles.sub}>
            {tiers.length} tier{tiers.length === 1 ? "" : "s"} · {activeCount} active. Manage pricing,
            eligibility and status. Changes take effect on the next assignment cycle.
          </p>
        </div>
        <Link to="/app/admin/subscription-tiers/new" style={styles.addBtn}>
          + Add New Tier
        </Link>
      </div>

      {actionData?.success && <div style={styles.ok}>✅ {actionData.success}</div>}
      {actionData?.error && <div style={styles.err}>⚠️ {actionData.error}</div>}

      {tiers.length === 0 ? (
        <div style={styles.empty}>
          <span style={{ fontSize: 44 }}>📦</span>
          <h3 style={{ margin: "8px 0 4px" }}>No subscription tiers yet</h3>
          <p style={styles.sub}>Create your first tier to start offering subscriptions.</p>
          <Link to="/app/admin/subscription-tiers/new" style={styles.addBtn}>+ Add New Tier</Link>
        </div>
      ) : (
        <div style={styles.grid}>
          {tiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} busy={busy} />
          ))}
        </div>
      )}

      {/* Audit trail */}
      <h3 style={styles.h3}>Recent Changes</h3>
      {audit.length === 0 ? (
        <p style={styles.sub}>No tier changes logged yet.</p>
      ) : (
        <div style={styles.auditList}>
          {audit.map((a) => (
            <div key={a.id} style={styles.auditRow}>
              <span style={styles.auditAction}>{auditActionLabel(a.action)}</span>
              <span style={styles.auditKey}>{a.details?.tierKey || "—"}</span>
              <span style={styles.auditActor}>{a.actor}</span>
              <span style={styles.auditTime}>{new Date(a.createdAt).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 1000 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 16, marginBottom: 20 },
  h2: { margin: 0, fontSize: 22, fontWeight: 700, color: "#111827" },
  sub: { margin: "4px 0 0", fontSize: 13, color: "#6B7280", maxWidth: 620, lineHeight: 1.5 },
  addBtn: { padding: "9px 18px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer", textDecoration: "none", whiteSpace: "nowrap", display: "inline-block" },
  ok: { padding: "12px 16px", background: "#F0FDF4", color: "#065F46", borderRadius: 8, marginBottom: 16, fontSize: 14 },
  err: { padding: "12px 16px", background: "#FEF2F2", color: "#DC2626", borderRadius: 8, marginBottom: 16, fontSize: 14 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16, marginBottom: 32 },
  empty: { textAlign: "center", padding: 48, background: "#fff", border: "1px dashed #D1D5DB", borderRadius: 12, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, marginBottom: 32 },
  h3: { fontSize: 15, fontWeight: 700, color: "#111827", margin: "8px 0 12px" },
  auditList: { display: "flex", flexDirection: "column", gap: 2, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 10, overflow: "hidden" },
  auditRow: { display: "grid", gridTemplateColumns: "100px 1fr 1fr 180px", gap: 12, padding: "10px 14px", fontSize: 12, borderBottom: "1px solid #F3F4F6", alignItems: "center" },
  auditAction: { fontWeight: 700, color: "#4338CA" },
  auditKey: { fontFamily: "monospace", color: "#374151" },
  auditActor: { color: "#6B7280" },
  auditTime: { color: "#9CA3AF", textAlign: "right" },
};
