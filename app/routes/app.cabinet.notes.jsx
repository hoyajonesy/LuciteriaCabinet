/**
 * Element Notes — Provenance Log (Phase 2B)
 *
 * Lets collectors attach structured provenance to each owned element:
 * acquisition date, source, price paid, condition, storage and private notes.
 * Powers the dashboard "Total Invested" card.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { useState } from "react";
import AppNav from "../components/AppNav";
import { getUserId } from "../lib/session.server";
import { requireNotFrozen } from "../lib/frozen-guard.server";
import { getUserById } from "../lib/auth.server";
import { getCollectionStats } from "../lib/collection.server";
import { getNotesMap, upsertNote, deleteNote, getInvestmentSummary, CONDITIONS } from "../lib/notes.server";

export const loader = async ({ request }) => {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  const stats = await getCollectionStats(userId);
  const notesMap = await getNotesMap(userId);
  const investment = await getInvestmentSummary(userId);

  // Owned elements with their note (if any)
  const owned = stats.ownedSymbols
    .map((sym) => {
      const note = notesMap[sym] || null;
      return {
        elementSymbol: sym,
        hasNote: !!note,
        note: note
          ? {
              acquisitionDate: note.acquisitionDate ? new Date(note.acquisitionDate).toISOString().slice(0, 10) : "",
              source: note.source || "",
              pricePaid: note.pricePaid ?? "",
              currency: note.currency || "USD",
              condition: note.condition || "",
              storageLocation: note.storageLocation || "",
              notes: note.notes || "",
            }
          : null,
      };
    })
    .sort((a, b) => Number(b.hasNote) - Number(a.hasNote) || a.elementSymbol.localeCompare(b.elementSymbol));

  return json({
    owned,
    investment,
    conditions: CONDITIONS,
    authUser: { firstName: authUser.firstName, userType: authUser.userType, isSubscriber: authUser.isSubscriber },
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  await requireNotFrozen(userId);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });

  const form = await request.formData();
  const intent = form.get("intent");
  const elementSymbol = form.get("elementSymbol");

  try {
    if (intent === "save") {
      await upsertNote(userId, elementSymbol, {
        acquisitionDate: form.get("acquisitionDate"),
        source: form.get("source"),
        pricePaid: form.get("pricePaid"),
        currency: form.get("currency"),
        condition: form.get("condition"),
        storageLocation: form.get("storageLocation"),
        notes: form.get("notes"),
      });
      return json({ ok: true, elementSymbol });
    }
    if (intent === "delete") {
      await deleteNote(userId, elementSymbol);
      return json({ ok: true, deleted: elementSymbol });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 400 });
  }
  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function ElementNotesPage() {
  const { owned, investment, conditions, authUser } = useLoaderData();
  const [active, setActive] = useState(null); // element being edited

  const withNotes = owned.filter((o) => o.hasNote).length;

  return (
    <div style={styles.layout}>
      <AppNav currentPath="/app/cabinet/notes" userType={authUser.userType} isSubscriber={authUser.isSubscriber} />
      <main style={styles.main} className="luc-main">
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Provenance & Notes</h1>
            <p style={styles.subtitle}>
              Record where, when and how you acquired each element. Notes are private to you.
            </p>
          </div>
          <Link to="/app/cabinet" style={styles.backLink}>← Back to Collection</Link>
        </div>

        {/* Investment summary */}
        <div style={styles.summaryRow}>
          <SummaryCard label="Total Invested" value={`$${investment.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon="💰" accent="#388E3C" />
          <SummaryCard label="Items Priced" value={`${investment.itemsWithPrice}`} icon="🏷️" accent="#1976D2" />
          <SummaryCard label="Avg / Item" value={`$${investment.avgPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })}`} icon="📊" accent="#7B1FA2" />
          <SummaryCard label="Elements Documented" value={`${withNotes}/${owned.length}`} icon="📝" accent="#F9A825" />
        </div>

        {owned.length === 0 ? (
          <div style={styles.empty}>
            <span style={styles.emptyIcon}>🧪</span>
            <h3 style={{ margin: "8px 0" }}>No owned elements yet</h3>
            <p style={styles.subtitle}>Mark elements as Owned on your collection to start logging provenance.</p>
            <Link to="/app/cabinet" style={styles.ctaBtn}>Go to Collection →</Link>
          </div>
        ) : (
          <div style={styles.grid}>
            {owned.map((o) => (
              <button key={o.elementSymbol} style={styles.elementCard} onClick={() => setActive(o)}>
                <div style={styles.cardTop}>
                  <span style={styles.symbol}>{o.elementSymbol}</span>
                  {o.hasNote && <span style={styles.noteFlag}>📝</span>}
                </div>
                {o.hasNote ? (
                  <div style={styles.cardMeta}>
                    {o.note.pricePaid !== "" && <span style={styles.priceTag}>${Number(o.note.pricePaid).toLocaleString()}</span>}
                    {o.note.condition && <span style={styles.condTag}>{o.note.condition}</span>}
                    {o.note.source && <span style={styles.sourceTag}>{o.note.source}</span>}
                  </div>
                ) : (
                  <span style={styles.addHint}>+ Add notes</span>
                )}
              </button>
            ))}
          </div>
        )}
      </main>

      {active && (
        <NoteModal
          element={active}
          conditions={conditions}
          onClose={() => setActive(null)}
        />
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, accent }) {
  return (
    <div style={styles.summaryCard}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <div>
        <div style={{ ...styles.summaryValue, color: accent }}>{value}</div>
        <div style={styles.summaryLabel}>{label}</div>
      </div>
    </div>
  );
}

function NoteModal({ element, conditions, onClose }) {
  const fetcher = useFetcher();
  const n = element.note || {};
  const saving = fetcher.state !== "idle";
  const justSaved = fetcher.data?.ok;

  // Close on successful save
  if (justSaved && saving === false) {
    // handled below via effect-like guard
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modalHeader}>
          <h3 style={{ margin: 0 }}>
            <span style={styles.modalSymbol}>{element.elementSymbol}</span> Provenance
          </h3>
          <button style={styles.closeBtn} onClick={onClose}>✕</button>
        </div>

        <fetcher.Form method="post" onSubmit={() => setTimeout(onClose, 350)}>
          <input type="hidden" name="elementSymbol" value={element.elementSymbol} />
          <input type="hidden" name="intent" value="save" />

          <div style={styles.formRow}>
            <label style={styles.label}>Acquisition Date
              <input type="date" name="acquisitionDate" defaultValue={n.acquisitionDate || ""} max={new Date().toISOString().slice(0, 10)} style={styles.input} />
            </label>
            <label style={styles.label}>Condition
              <select name="condition" defaultValue={n.condition || ""} style={styles.input}>
                <option value="">—</option>
                {conditions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
          </div>

          <div style={styles.formRow}>
            <label style={styles.label}>Price Paid
              <input type="number" name="pricePaid" step="0.01" min="0" defaultValue={n.pricePaid ?? ""} placeholder="0.00" style={styles.input} />
            </label>
            <label style={styles.label}>Currency
              <input type="text" name="currency" maxLength={3} defaultValue={n.currency || "USD"} style={styles.input} />
            </label>
          </div>

          <label style={styles.label}>Source
            <input type="text" name="source" defaultValue={n.source || ""} placeholder="Vendor, eBay seller, gift, trade…" style={styles.input} />
          </label>

          <label style={styles.label}>Storage Location
            <input type="text" name="storageLocation" defaultValue={n.storageLocation || ""} placeholder="Display case, drawer, safe…" style={styles.input} />
          </label>

          <label style={styles.label}>Private Notes
            <textarea name="notes" defaultValue={n.notes || ""} rows={4} placeholder="Anything memorable about this acquisition…" style={{ ...styles.input, resize: "vertical" }} />
          </label>

          {fetcher.data?.error && <p style={styles.errorText}>{fetcher.data.error}</p>}

          <div style={styles.modalActions}>
            {element.hasNote && (
              <button
                type="button"
                style={styles.deleteBtn}
                onClick={() => {
                  fetcher.submit({ intent: "delete", elementSymbol: element.elementSymbol }, { method: "post" });
                  setTimeout(onClose, 350);
                }}
              >
                Delete
              </button>
            )}
            <div style={{ flex: 1 }} />
            <button type="button" style={styles.cancelBtn} onClick={onClose}>Cancel</button>
            <button type="submit" style={styles.saveBtn} disabled={saving}>{saving ? "Saving…" : "Save Notes"}</button>
          </div>
        </fetcher.Form>
      </div>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#f8f9fa" },
  main: { flex: 1, marginLeft: 240, padding: "24px 32px", maxWidth: 1100 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 },
  subtitle: { fontSize: 14, color: "#666", margin: "4px 0 0" },
  backLink: { fontSize: 13, color: "#1976D2", textDecoration: "none", fontWeight: 600 },
  summaryRow: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 16, marginBottom: 24 },
  summaryCard: { background: "#fff", borderRadius: 12, padding: "16px 20px", border: "1px solid #e9ecef", display: "flex", alignItems: "center", gap: 14 },
  summaryValue: { fontSize: 22, fontWeight: 800, lineHeight: 1.1 },
  summaryLabel: { fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase", marginTop: 2 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 },
  elementCard: { textAlign: "left", background: "#fff", border: "1px solid #e9ecef", borderRadius: 12, padding: 14, cursor: "pointer", fontFamily: "inherit", minHeight: 92 },
  cardTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  symbol: { fontSize: 24, fontWeight: 800, color: "#1976D2" },
  noteFlag: { fontSize: 14 },
  cardMeta: { display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 },
  priceTag: { fontSize: 11, fontWeight: 700, color: "#388E3C", background: "#E8F5E9", padding: "2px 6px", borderRadius: 4 },
  condTag: { fontSize: 11, color: "#7B1FA2", background: "#F3E5F5", padding: "2px 6px", borderRadius: 4 },
  sourceTag: { fontSize: 11, color: "#666", background: "#f0f0f0", padding: "2px 6px", borderRadius: 4, maxWidth: 110, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  addHint: { fontSize: 12, color: "#aaa", marginTop: 12, display: "block" },
  empty: { textAlign: "center", padding: 60, background: "#fff", borderRadius: 16, border: "1px solid #e9ecef" },
  emptyIcon: { fontSize: 48 },
  ctaBtn: { display: "inline-block", marginTop: 12, padding: "10px 24px", background: "#1976D2", color: "#fff", borderRadius: 8, textDecoration: "none", fontSize: 14, fontWeight: 600 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 20 },
  modal: { background: "#fff", borderRadius: 16, padding: 24, width: 480, maxWidth: "100%", maxHeight: "90vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 },
  modalSymbol: { color: "#1976D2", fontWeight: 800 },
  closeBtn: { background: "none", border: "none", fontSize: 18, cursor: "pointer", color: "#999" },
  formRow: { display: "flex", gap: 12 },
  label: { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: "#555", marginBottom: 12, flex: 1 },
  input: { padding: "8px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit", fontWeight: 400 },
  errorText: { color: "#dc2626", fontSize: 13, margin: "0 0 12px" },
  modalActions: { display: "flex", gap: 8, alignItems: "center", marginTop: 8 },
  deleteBtn: { padding: "8px 14px", background: "#fff", border: "1px solid #fca5a5", color: "#dc2626", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  cancelBtn: { padding: "8px 16px", background: "#fff", border: "1px solid #ddd", color: "#555", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  saveBtn: { padding: "8px 18px", background: "#1976D2", color: "#fff", border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" },
};
