/**
 * Admin — Swap & Skip Window Settings, Audit & Per-Shipment History
 * /app/admin/swap-window/settings
 *
 * Three responsibilities on one surface:
 *  1. Settings (FR-27/FR-28/FR-30/FR-31) — edit the single settings profile that
 *     applies across all tiers. Changes are prospective only; in-flight windows
 *     keep their snapshotted terms (FR-29, enforced at enterSwapWindow).
 *  2. Settings audit trail (FR-28 / Section 6.5) — every field change with who,
 *     when, old value, new value.
 *  3. Per-shipment window status, original-vs-current pick, full decision history
 *     (FR-22), plus staff overrides — force finalize, override pick, extend
 *     window (FR-23) — each attributed to the acting staff member.
 */
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, Link, useNavigation } from "@remix-run/react";
import { requireAdmin } from "../lib/admin.server.js";
import { prisma } from "../lib/db.server.js";
import {
  HELD_STATUS,
  getSwapWindowSettings,
  updateSwapWindowSettings,
  getSettingsAudit,
  getSwapHistory,
  staffForceFinalize,
  staffOverridePick,
  staffExtendWindow,
} from "../lib/swap-window.server.js";

const BOOL_FIELDS = [
  ["swapFinalizesImmediately", "Swap finalizes immediately", "A confirmed swap places the order right away instead of waiting out the rest of the window."],
  ["allowMultipleDecisionChanges", "Allow multiple decision changes", "Let a subscriber revise their swap/skip choice while the window is still open."],
  ["firstShipmentGetsWindow", "First shipment gets a window", "The very first cycle's assignment also enters a swap window."],
  ["backstopAssignmentGetsWindow", "Backstop assignment gets a window", "Assignments made in onboarding BACKSTOP_ONLY mode also enter a window."],
  ["skipCreditStackableWithTierCredit", "Skip credit stackable with tier credit", "Skip credit can accumulate alongside empty-pool carry-forward credit."],
  ["skipCreditRefundOnCancellation", "Refund skip credit on cancellation", "If on, a cancelled mid-window cycle is refunded rather than converted to store credit."],
];

const NUM_FIELDS = [
  ["windowLengthDays", "Window length (days)", "How long a subscriber has to swap or skip before the pick ships automatically.", false],
  ["skipCreditExpiryDays", "Skip credit expiry (days)", "General expiry for banked skip credit. Leave blank for no expiry.", true],
  ["skipCreditPostCancellationDays", "Post-cancellation credit window (days)", "How long banked credit remains usable after the subscription is cancelled.", false],
];

async function loadHeldShipments(limit = 40) {
  const held = await prisma.subscriptionShipment.findMany({
    where: { status: HELD_STATUS, finalizationClaimed: false },
    orderBy: { windowExpiresAt: "asc" },
    take: limit,
  });

  const out = [];
  for (const s of held) {
    const [item, original, customer, history] = await Promise.all([
      prisma.shipmentItem.findFirst({ where: { shipmentId: s.id } }),
      s.originalProductId ? prisma.product.findUnique({ where: { id: s.originalProductId } }) : null,
      prisma.customer.findUnique({ where: { id: s.customerId } }),
      getSwapHistory(s.id).catch(() => []),
    ]);
    const current = item?.productId ? await prisma.product.findUnique({ where: { id: item.productId } }) : null;
    out.push({
      id: s.id,
      customer: customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() || customer.email : s.customerId,
      windowExpiresAt: s.windowExpiresAt,
      swapDecision: s.swapDecision,
      original: original ? { title: original.title, symbol: original.elementSymbol } : null,
      current: current ? { title: current.title, symbol: current.elementSymbol } : null,
      history: (history || []).map((h) => ({
        id: h.id, action: h.action, source: h.source, note: h.note, createdAt: h.createdAt, staffId: h.staffId,
      })),
    });
  }
  return out;
}

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const [settings, audit, held] = await Promise.all([
    getSwapWindowSettings(),
    getSettingsAudit(50),
    loadHeldShipments(),
  ]);
  return json({ settings, audit, held });
};

function parseSettingsForm(form) {
  const changes = {};
  for (const [key] of BOOL_FIELDS) {
    changes[key] = form.get(key) === "on";
  }
  for (const [key, , , nullable] of NUM_FIELDS) {
    const raw = form.get(key);
    if (nullable && (raw == null || String(raw).trim() === "")) {
      changes[key] = null;
    } else {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n)) changes[key] = n;
    }
  }
  // skipCreditRedeemableAtCheckout is a toggle (FR-30) — stored but labeled inactive.
  changes.skipCreditRedeemableAtCheckout = form.get("skipCreditRedeemableAtCheckout") === "on";
  return changes;
}

export const action = async ({ request }) => {
  const staff = await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "save-settings") {
      const changes = parseSettingsForm(form);
      const { audits } = await updateSwapWindowSettings({ changes, adminUserId: staff.id });
      return json({ ok: true, kind: "settings", changed: audits.length });
    }
    if (intent === "staff-force-finalize") {
      const res = await staffForceFinalize({ shipmentId: form.get("shipmentId"), staffId: staff.id });
      return res.ok
        ? json({ ok: true, kind: "override", message: "Shipment finalized." })
        : json({ error: res.message || "Could not finalize." }, { status: 400 });
    }
    if (intent === "staff-override-pick") {
      const res = await staffOverridePick({
        shipmentId: form.get("shipmentId"),
        newProductId: form.get("newProductId"),
        staffId: staff.id,
      });
      return res.ok
        ? json({ ok: true, kind: "override", message: "Pick overridden and finalized." })
        : json({ error: res.message || "Could not override pick." }, { status: 400 });
    }
    if (intent === "staff-extend") {
      const res = await staffExtendWindow({
        shipmentId: form.get("shipmentId"),
        additionalDays: form.get("additionalDays"),
        staffId: staff.id,
      });
      return res.ok
        ? json({ ok: true, kind: "override", message: "Window extended." })
        : json({ error: res.message || "Could not extend window." }, { status: 400 });
    }
  } catch (e) {
    return json({ error: e.message }, { status: 400 });
  }
  return json({ error: "Unknown action." }, { status: 400 });
};

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
  } catch {
    return "—";
  }
}

export default function SwapWindowSettings() {
  const { settings, audit, held } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const saving = nav.state !== "idle" && nav.formData?.get("intent") === "save-settings";

  return (
    <div>
      <div style={styles.headerRow}>
        <div>
          <h2 style={styles.title}>Swap &amp; Skip Window — Settings</h2>
          <p style={styles.subtitle}>
            One profile applies across all tiers (FR-31). Changes are prospective — shipments already
            in a window keep the terms in effect when they opened (FR-29).
          </p>
        </div>
        <Link to="/app/admin/swap-window" style={styles.backLink}>← Operations</Link>
      </div>

      {actionData?.ok && actionData.kind === "settings" && (
        <div style={styles.noticeOk}>
          Settings saved — {actionData.changed} field(s) changed.
        </div>
      )}
      {actionData?.ok && actionData.kind === "override" && (
        <div style={styles.noticeOk}>{actionData.message}</div>
      )}
      {actionData?.error && <div style={styles.noticeErr}>{actionData.error}</div>}

      {/* Settings form */}
      <Form method="post" style={styles.card}>
        <input type="hidden" name="intent" value="save-settings" />

        <div style={styles.numGrid}>
          {NUM_FIELDS.map(([key, label, help, nullable]) => (
            <div key={key} style={styles.numField}>
              <label style={styles.numLabel}>{label}</label>
              <input
                type="number"
                name={key}
                min={nullable ? undefined : 1}
                defaultValue={settings[key] == null ? "" : settings[key]}
                placeholder={nullable ? "none" : ""}
                style={styles.numInput}
              />
              <span style={styles.help}>{help}</span>
            </div>
          ))}
        </div>

        <div style={styles.boolList}>
          {BOOL_FIELDS.map(([key, label, help]) => (
            <label key={key} style={styles.boolRow}>
              <input type="checkbox" name={key} defaultChecked={!!settings[key]} style={styles.checkbox} />
              <span>
                <span style={styles.boolLabel}>{label}</span>
                <span style={styles.help}>{help}</span>
              </span>
            </label>
          ))}

          {/* FR-30: checkout-redeemable toggle, explicitly labeled not-yet-connected. */}
          <label style={{ ...styles.boolRow, background: "#fff7ed", borderColor: "#fed7aa" }}>
            <input
              type="checkbox"
              name="skipCreditRedeemableAtCheckout"
              defaultChecked={!!settings.skipCreditRedeemableAtCheckout}
              style={styles.checkbox}
            />
            <span>
              <span style={styles.boolLabel}>
                Skip credit redeemable at checkout{" "}
                <span style={styles.notConnected}>NOT YET CONNECTED</span>
              </span>
              <span style={styles.help}>
                Stores the preference only. The Shopify checkout-redemption integration that would make
                banked credit actually spendable at checkout is a separate, unbuilt project — enabling
                this does not yet make credit spendable anywhere.
              </span>
            </span>
          </label>
        </div>

        <button type="submit" style={{ ...styles.saveBtn, opacity: saving ? 0.6 : 1 }} disabled={saving}>
          {saving ? "Saving…" : "Save settings"}
        </button>
      </Form>

      {/* Held shipments + staff tools (FR-22 / FR-23) */}
      <h3 style={styles.sectionTitle}>Held shipments ({held.length})</h3>
      {held.length === 0 ? (
        <p style={styles.muted}>No shipments are currently in a swap window.</p>
      ) : (
        held.map((s) => <HeldShipmentCard key={s.id} s={s} />)
      )}

      {/* Settings audit trail (FR-28) */}
      <h3 style={styles.sectionTitle}>Settings change history</h3>
      {audit.length === 0 ? (
        <p style={styles.muted}>No settings changes recorded yet.</p>
      ) : (
        <div style={styles.card}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>When</th>
                <th style={styles.th}>Field</th>
                <th style={styles.th}>Old</th>
                <th style={styles.th}>New</th>
                <th style={styles.th}>Admin</th>
              </tr>
            </thead>
            <tbody>
              {audit.map((a) => (
                <tr key={a.id}>
                  <td style={styles.td}>{fmtDate(a.changedAt)}</td>
                  <td style={styles.td}><code>{a.settingField}</code></td>
                  <td style={styles.td}>{a.oldValue ?? "—"}</td>
                  <td style={styles.td}><strong>{a.newValue}</strong></td>
                  <td style={styles.td}><span style={styles.mono}>{a.adminUserId?.slice(0, 8)}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HeldShipmentCard({ s }) {
  return (
    <div style={styles.card}>
      <div style={styles.shipHeader}>
        <div>
          <div style={styles.shipCustomer}>{s.customer}</div>
          <div style={styles.shipMeta}>
            Closes {fmtDate(s.windowExpiresAt)} · decision: {s.swapDecision}
          </div>
        </div>
        <div style={styles.picks}>
          <span style={styles.pickChip}>
            <span style={styles.pickChipLabel}>Original</span>
            {s.original ? `${s.original.title}` : "—"}
          </span>
          <span style={{ ...styles.pickChip, background: "#eff6ff", borderColor: "#bfdbfe" }}>
            <span style={styles.pickChipLabel}>Current</span>
            {s.current ? `${s.current.title}` : "—"}
          </span>
        </div>
      </div>

      {/* Decision history (FR-22) */}
      {s.history.length > 0 && (
        <div style={styles.histBox}>
          {s.history.map((h) => (
            <div key={h.id} style={styles.histRow}>
              <span style={styles.histAction}>{h.action}</span>
              <span style={styles.histNote}>{h.note || ""}</span>
              <span style={styles.histMeta}>
                {fmtDate(h.createdAt)} · {h.source?.toLowerCase()}
                {h.staffId ? ` · staff ${h.staffId.slice(0, 8)}` : ""}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Staff overrides (FR-23) */}
      <div style={styles.toolRow}>
        <Form method="post" style={styles.toolForm}>
          <input type="hidden" name="intent" value="staff-force-finalize" />
          <input type="hidden" name="shipmentId" value={s.id} />
          <button type="submit" style={styles.toolBtn}>Force finalize</button>
        </Form>

        <Form method="post" style={styles.toolForm}>
          <input type="hidden" name="intent" value="staff-override-pick" />
          <input type="hidden" name="shipmentId" value={s.id} />
          <input type="text" name="newProductId" placeholder="Product ID" style={styles.toolInput} required />
          <button type="submit" style={styles.toolBtn}>Override pick</button>
        </Form>

        <Form method="post" style={styles.toolForm}>
          <input type="hidden" name="intent" value="staff-extend" />
          <input type="hidden" name="shipmentId" value={s.id} />
          <input type="number" name="additionalDays" min="1" defaultValue="3" style={{ ...styles.toolInput, width: 60 }} />
          <button type="submit" style={styles.toolBtn}>Extend (days)</button>
        </Form>
      </div>
    </div>
  );
}

const styles = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16, gap: 16 },
  title: { fontSize: 20, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: 0 },
  subtitle: { fontSize: 13, color: "var(--luc-text-muted, #666)", margin: "4px 0 0", maxWidth: 640 },
  backLink: { color: "var(--luc-accent, #2563eb)", textDecoration: "none", fontSize: 13, fontWeight: 600, whiteSpace: "nowrap" },
  card: {
    background: "#fff", border: "1px solid var(--luc-border, #e0e0e0)", borderRadius: 10, padding: 20,
    marginBottom: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  numGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 20 },
  numField: { display: "flex", flexDirection: "column", gap: 4 },
  numLabel: { fontSize: 13, fontWeight: 600, color: "var(--luc-text, #1a1a1a)" },
  numInput: { padding: "8px 10px", border: "1px solid var(--luc-border, #d0d0d0)", borderRadius: 8, fontSize: 14, maxWidth: 160 },
  boolList: { display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 },
  boolRow: {
    display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 14px",
    border: "1px solid var(--luc-border, #eee)", borderRadius: 10, cursor: "pointer",
  },
  checkbox: { marginTop: 3, width: 16, height: 16, flexShrink: 0 },
  boolLabel: { display: "block", fontSize: 14, fontWeight: 600, color: "var(--luc-text, #1a1a1a)" },
  help: { display: "block", fontSize: 12, color: "var(--luc-text-muted, #888)", marginTop: 2, lineHeight: 1.4 },
  notConnected: {
    fontSize: 10, fontWeight: 700, background: "#fed7aa", color: "#9a3412",
    padding: "2px 6px", borderRadius: 4, marginLeft: 6, verticalAlign: "middle", letterSpacing: "0.04em",
  },
  saveBtn: {
    background: "var(--luc-accent, #2563eb)", color: "#fff", border: "none", borderRadius: 8,
    padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: "8px 0 14px" },
  muted: { fontSize: 13, color: "var(--luc-text-muted, #888)", marginBottom: 20 },
  shipHeader: { display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" },
  shipCustomer: { fontSize: 15, fontWeight: 700, color: "var(--luc-text, #1a1a1a)" },
  shipMeta: { fontSize: 12, color: "var(--luc-text-muted, #888)", marginTop: 2 },
  picks: { display: "flex", gap: 8, flexWrap: "wrap" },
  pickChip: {
    fontSize: 12, background: "#f5f5f4", border: "1px solid #e7e5e4", borderRadius: 8,
    padding: "6px 10px", display: "flex", flexDirection: "column", gap: 2, minWidth: 90,
  },
  pickChipLabel: { fontSize: 10, textTransform: "uppercase", letterSpacing: "0.04em", color: "#999" },
  histBox: { marginTop: 14, paddingTop: 12, borderTop: "1px dashed #e5e5e5", display: "flex", flexDirection: "column", gap: 8 },
  histRow: { display: "flex", flexDirection: "column", gap: 1 },
  histAction: { fontSize: 12, fontWeight: 700, color: "#374151" },
  histNote: { fontSize: 13, color: "var(--luc-text, #1a1a1a)" },
  histMeta: { fontSize: 11, color: "var(--luc-text-muted, #999)" },
  toolRow: { display: "flex", gap: 10, flexWrap: "wrap", marginTop: 16, paddingTop: 14, borderTop: "1px solid #f0f0f0" },
  toolForm: { display: "flex", gap: 6, alignItems: "center" },
  toolInput: { padding: "7px 9px", border: "1px solid var(--luc-border, #d0d0d0)", borderRadius: 7, fontSize: 13, width: 130 },
  toolBtn: {
    background: "#fff", border: "1px solid var(--luc-border, #cbd5e1)", borderRadius: 7,
    padding: "7px 12px", fontSize: 13, fontWeight: 600, cursor: "pointer", color: "#334155", whiteSpace: "nowrap",
  },
  noticeOk: { background: "#dcfce7", color: "#059669", fontSize: 13, padding: "10px 12px", borderRadius: 8, marginBottom: 16 },
  noticeErr: { background: "#fee2e2", color: "#dc2626", fontSize: 13, padding: "10px 12px", borderRadius: 8, marginBottom: 16 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #eee", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#999" },
  td: { padding: "8px 10px", borderBottom: "1px solid #f2f2f2", color: "var(--luc-text, #333)" },
  mono: { fontFamily: "monospace", fontSize: 12, color: "#666" },
};
