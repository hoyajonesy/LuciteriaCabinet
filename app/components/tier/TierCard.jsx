/**
 * TierCard — one subscription tier in the admin list view. Shows pricing,
 * credit value, allowed formats and status, with Edit / Activate-Deactivate /
 * Delete actions. Destructive actions confirm inline; delete is disabled when
 * the tier has live subscribers.
 */
import { Link, Form } from "@remix-run/react";
import { formatCurrency, formatPercent } from "./tier-form-helpers.js";

export default function TierCard({ tier, busy = false }) {
  const active = tier.isActive;
  const formats =
    Array.isArray(tier.allowedCollectionTypes) && tier.allowedCollectionTypes.length > 0
      ? tier.allowedCollectionTypes
      : tier.collectionType
        ? [tier.collectionType]
        : [];
  const subs = tier.activeSubscribers ?? 0;
  const canDelete = subs === 0;

  return (
    <div style={{ ...styles.card, ...(active ? {} : styles.inactive) }}>
      <div style={styles.head}>
        <div style={styles.titleWrap}>
          <span style={{ ...styles.dot, background: active ? "#10B981" : "#9CA3AF" }} />
          <div>
            <h3 style={styles.name}>{tier.displayName}</h3>
            <code style={styles.key}>{tier.name}</code>
          </div>
        </div>
        <span style={{ ...styles.status, ...(active ? styles.statusOn : styles.statusOff) }}>
          {active ? "Active" : "Inactive"}
        </span>
      </div>

      {tier.description && <p style={styles.desc}>{tier.description}</p>}

      <div style={styles.stats}>
        <Stat label="Monthly" value={formatCurrency(tier.monthlyPrice)} />
        <Stat label="Credit" value={tier.creditValue != null ? formatCurrency(tier.creditValue) : "—"} />
        <Stat label="Discount" value={formatPercent(tier.discountPercentage)} />
        <Stat label="Subscribers" value={String(subs)} />
      </div>

      <div style={styles.formats}>
        {formats.length === 0 ? (
          <span style={styles.noFormat}>No formats configured</span>
        ) : (
          formats.map((f) => (
            <span key={f} style={styles.formatPill}>{f}</span>
          ))
        )}
        {tier.excludePreciousMetals && <span style={styles.excludePill}>excl. precious metals</span>}
      </div>

      <div style={styles.actions}>
        <Link to={`/app/admin/subscription-tiers/${tier.id}`} style={styles.editBtn}>
          ✏️ Edit
        </Link>

        <Form method="post" style={styles.inlineForm}>
          <input type="hidden" name="intent" value="toggle" />
          <input type="hidden" name="tierId" value={tier.id} />
          <input type="hidden" name="isActive" value={active ? "false" : "true"} />
          <button type="submit" style={styles.toggleBtn} disabled={busy}>
            {active ? "⏸ Deactivate" : "▶ Activate"}
          </button>
        </Form>

        <Form
          method="post"
          style={styles.inlineForm}
          onSubmit={(e) => {
            if (!confirm(`Delete tier "${tier.displayName}"? This cannot be undone.`)) e.preventDefault();
          }}
        >
          <input type="hidden" name="intent" value="delete" />
          <input type="hidden" name="tierId" value={tier.id} />
          <button
            type="submit"
            style={{ ...styles.deleteBtn, ...(canDelete ? {} : styles.deleteDisabled) }}
            disabled={busy || !canDelete}
            title={canDelete ? "Delete tier" : `Cannot delete — ${subs} active subscriber(s)`}
          >
            🗑 Delete
          </button>
        </Form>
      </div>
      {!canDelete && (
        <p style={styles.guard}>🔒 Has {subs} active subscriber{subs === 1 ? "" : "s"} — deactivate instead of deleting.</p>
      )}
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={styles.stat}>
      <span style={styles.statLabel}>{label}</span>
      <span style={styles.statValue}>{value}</span>
    </div>
  );
}

const styles = {
  card: { padding: 20, background: "#fff", borderRadius: 12, border: "1px solid #E5E7EB", display: "flex", flexDirection: "column", gap: 12 },
  inactive: { opacity: 0.72, background: "#FAFAFA" },
  head: { display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 },
  titleWrap: { display: "flex", alignItems: "center", gap: 10 },
  dot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  name: { margin: 0, fontSize: 17, fontWeight: 700, color: "#111827" },
  key: { fontSize: 11, color: "#6366F1", background: "#EEF2FF", padding: "1px 6px", borderRadius: 4 },
  status: { fontSize: 11, fontWeight: 600, padding: "2px 10px", borderRadius: 12 },
  statusOn: { background: "#D1FAE5", color: "#065F46" },
  statusOff: { background: "#F3F4F6", color: "#6B7280" },
  desc: { margin: 0, fontSize: 13, color: "#6B7280", lineHeight: 1.4 },
  stats: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  stat: { display: "flex", flexDirection: "column" },
  statLabel: { fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.4px" },
  statValue: { fontSize: 15, fontWeight: 700, color: "#111827" },
  formats: { display: "flex", flexWrap: "wrap", gap: 6 },
  formatPill: { fontSize: 11, fontWeight: 600, color: "#1E40AF", background: "#DBEAFE", padding: "2px 8px", borderRadius: 6 },
  excludePill: { fontSize: 11, fontWeight: 600, color: "#92400E", background: "#FEF3C7", padding: "2px 8px", borderRadius: 6 },
  noFormat: { fontSize: 11, color: "#DC2626" },
  actions: { display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" },
  inlineForm: { display: "inline" },
  editBtn: { padding: "5px 12px", background: "#EEF2FF", color: "#4338CA", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer", textDecoration: "none", display: "inline-block" },
  toggleBtn: { padding: "5px 12px", background: "#FEF3C7", color: "#92400E", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  deleteBtn: { padding: "5px 12px", background: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" },
  deleteDisabled: { opacity: 0.5, cursor: "not-allowed" },
  guard: { margin: 0, fontSize: 11, color: "#92400E" },
};
