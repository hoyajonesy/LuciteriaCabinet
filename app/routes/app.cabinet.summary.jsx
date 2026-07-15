/**
 * Collection Summary Screen — "My Collection Ledger"
 *
 * Read-only catalog of every OWNED element in one structured, sortable table.
 * One row per element with an expandable sub-row revealing each physical
 * sample's full provenance (acquisition date, source, price, condition,
 * format, storage, private notes).
 *
 * Pure read view over existing tables (CollectionItem + ElementSample +
 * ElementNote). No migration. Dates / currency formatted server-side with an
 * explicit locale + UTC timeZone to avoid hydration mismatches.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useMemo, useState } from "react";
import AppNav from "../components/AppNav";
import NotesModal from "../components/NotesModal";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { getUnreadCount } from "../lib/notifications-db.server";
import { prisma } from "../lib/db.server";
import { saveSamples } from "../lib/samples.server";
import { checkMilestones } from "../lib/milestones.server";
import { requireNotFrozen } from "../lib/frozen-guard.server";

/* ─────────────── server-side formatting helpers ─────────────── */

const DATE_LONG = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "numeric",
});
const DATE_NUMERIC = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtDateLong(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return DATE_LONG.format(dt);
}
function fmtDateNumeric(d) {
  if (!d) return "—";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "—";
  return DATE_NUMERIC.format(dt);
}
function fmtMoney(v, currency = "USD") {
  if (v == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "USD" }).format(v);
  } catch {
    return `${v} ${currency || ""}`.trim();
  }
}
function labelByCurrency(map) {
  // map: { USD: 1240, GBP: 55 } -> "$1,240.00 + £55.00"
  const keys = Object.keys(map);
  if (keys.length === 0) return null;
  return keys.map((c) => fmtMoney(map[c], c)).join(" + ");
}

/**
 * An owned CollectionItem may store provenance as ElementSample rows (primary),
 * or — for legacy/parallel data — a single 1:1 ElementNote. Normalize an
 * ElementNote into the same shape as a sample so the UI can treat both alike.
 */
function noteToSample(note, fallbackFormat) {
  return {
    acquisitionDate: note.acquisitionDate,
    source: note.source,
    pricePaid: note.pricePaid,
    currency: note.currency || "USD",
    condition: note.condition,
    format: fallbackFormat || null,
    storageLocation: note.storageLocation,
    notes: note.notes,
  };
}

async function loadLedger(userId) {
  const items = await prisma.collectionItem.findMany({
    where: { userId, state: "OWNED" },
    include: { samples: true, elementNote: true },
    orderBy: { elementName: "asc" },
  });

  let totalSamples = 0;
  const investedByCurrency = {};
  let mostRecent = null;

  const rows = items.map((item) => {
    // Authoritative per-specimen source = samples; fall back to elementNote.
    const rawSamples =
      item.samples && item.samples.length
        ? item.samples
        : item.elementNote
        ? [noteToSample(item.elementNote, item.format)]
        : [];

    totalSamples += rawSamples.length;

    // element-level aggregates
    const elPaidByCurrency = {};
    let earliest = null;
    let sortPaid = 0;
    const formatSet = new Set();
    const conditionSet = new Set();

    const samples = rawSamples.map((s) => {
      if (s.pricePaid != null) {
        const cur = s.currency || "USD";
        elPaidByCurrency[cur] = (elPaidByCurrency[cur] || 0) + s.pricePaid;
        investedByCurrency[cur] = (investedByCurrency[cur] || 0) + s.pricePaid;
        sortPaid += s.pricePaid;
      }
      if (s.acquisitionDate) {
        const dt = new Date(s.acquisitionDate);
        if (!earliest || dt < earliest) earliest = dt;
        if (!mostRecent || dt > mostRecent) mostRecent = dt;
      }
      if (s.format) formatSet.add(s.format);
      if (s.condition) conditionSet.add(s.condition);

      return {
        acquisitionDateFmt: fmtDateNumeric(s.acquisitionDate),
        source: s.source || "—",
        pricePaidFmt: s.pricePaid != null ? fmtMoney(s.pricePaid, s.currency) : "—",
        condition: s.condition || "—",
        format: s.format || "—",
        storageLocation: s.storageLocation || "—",
        notes: s.notes || "—",
      };
    });

    const formats = [...formatSet];
    const conditions = [...conditionSet];

    // Combined notes across all samples (for the Notes column).
    const noteParts = rawSamples.map((s) => (s.notes || "").trim()).filter(Boolean);
    const notesCombined = noteParts.join(" • ");

    // Raw, editable sample records for the in-screen editor (NotesModal).
    const editSamples = rawSamples.map((s) => ({
      acquisitionDate: s.acquisitionDate ? new Date(s.acquisitionDate).toISOString() : "",
      source: s.source || "",
      pricePaid: s.pricePaid != null ? s.pricePaid : "",
      condition: s.condition || "",
      format: s.format || "",
      storageLocation: s.storageLocation || "",
      notes: s.notes || "",
    }));

    return {
      symbol: item.elementSymbol,
      name: item.elementName,
      atomicNumber: item.atomicNumber,
      sampleCount: samples.length,
      formatsLabel: formats.length === 0 ? "—" : formats.length === 1 ? formats[0] : `Mixed (${formats.length})`,
      conditionLabel: conditions.length === 0 ? "—" : conditions.length === 1 ? conditions[0] : "Varies",
      earliestAcquiredFmt: fmtDateLong(earliest),
      earliestAcquiredSort: earliest ? earliest.toISOString() : "",
      totalPaidLabel: labelByCurrency(elPaidByCurrency) || "—",
      totalPaidSort: sortPaid,
      notesCombined,
      notesPreview: notesCombined || "—",
      editSamples,
      samples,
    };
  });

  const totals = {
    totalElements: rows.length,
    totalPossible: 118,
    totalSamples,
    investedLabel: labelByCurrency(investedByCurrency) || fmtMoney(0, "USD"),
    mostRecentFmt: fmtDateLong(mostRecent),
  };

  return { rows, totals };
}

/* ─────────────── loader ─────────────── */

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  const { rows, totals } = await loadLedger(userId);
  const unreadCount = await getUnreadCount(userId);

  return json({
    rows,
    totals,
    customerName: authUser.firstName || "Collector",
    unreadCount,
  });
};

/* ─────────────── action (in-screen editing) ─────────────── */

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ ok: false, error: "Not authenticated" }, { status: 401 });
  await requireNotFrozen(userId);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "save-samples") {
    const symbol = formData.get("symbol");
    let samples = [];
    try {
      samples = JSON.parse(formData.get("samples") || "[]");
    } catch {
      return json({ ok: false, error: "Invalid samples payload" }, { status: 400 });
    }
    try {
      const saved = await saveSamples(userId, symbol, samples);
      await checkMilestones(userId);
      return json({ ok: true, samples: saved });
    } catch (e) {
      return json({ ok: false, error: e.message }, { status: 400 });
    }
  }

  return json({ ok: false, error: "Unknown intent" }, { status: 400 });
};

/* ─────────────── component ─────────────── */

const COLUMNS = [
  { key: "name", label: "Element", sortVal: (r) => r.name.toLowerCase() },
  { key: "formatsLabel", label: "Format(s)", sortVal: (r) => r.formatsLabel.toLowerCase() },
  { key: "conditionLabel", label: "Condition", sortVal: (r) => r.conditionLabel.toLowerCase() },
  { key: "sampleCount", label: "Samples", sortVal: (r) => r.sampleCount, align: "center" },
  { key: "earliestAcquiredSort", label: "Acquired", sortVal: (r) => r.earliestAcquiredSort },
  { key: "totalPaidSort", label: "Total Paid", sortVal: (r) => r.totalPaidSort, align: "right" },
];

export default function CollectionSummary() {
  const { rows, totals, customerName, unreadCount } = useLoaderData();
  const [expanded, setExpanded] = useState(() => new Set());
  const [sortKey, setSortKey] = useState("name");
  const [sortDir, setSortDir] = useState("asc");
  const [query, setQuery] = useState("");
  const [editRow, setEditRow] = useState(null); // element row currently being edited

  const toggleRow = (sym) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(sym) ? next.delete(sym) : next.add(sym);
      return next;
    });

  const onSort = (key) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const visible = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sortKey) || COLUMNS[0];
    const q = query.trim().toLowerCase();
    const filtered = q
      ? rows.filter((r) => r.name.toLowerCase().includes(q) || r.symbol.toLowerCase().includes(q))
      : rows.slice();
    const dir = sortDir === "asc" ? 1 : -1;
    filtered.sort((a, b) => {
      const av = col.sortVal(a);
      const bv = col.sortVal(b);
      if (av < bv) return -1 * dir;
      if (av > bv) return 1 * dir;
      return a.atomicNumber - b.atomicNumber; // secondary tiebreaker
    });
    return filtered;
  }, [rows, sortKey, sortDir, query]);

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-700">
      <AppNav currentPath="/app/cabinet/summary" customerName={customerName} unreadCount={unreadCount} />

      <main className="luc-main flex-1 px-4 py-5 sm:px-8 sm:py-8">
        {/* Header */}
        <div className="mb-5">
          <h1 style={styles.title}>My Collection Ledger</h1>
          <p style={styles.subtitle}>Every owned element and its full provenance in one view.</p>
        </div>

        {/* Summary header strip */}
        <div style={styles.statStrip}>
          <Stat label="Elements Owned" value={`${totals.totalElements} / ${totals.totalPossible}`} icon="fa-cube" />
          <Stat label="Total Samples" value={totals.totalSamples} icon="fa-layer-group" />
          <Stat label="Total Invested" value={totals.investedLabel} icon="fa-sack-dollar" />
          <Stat label="Most Recent Acquisition" value={totals.mostRecentFmt} icon="fa-clock-rotate-left" />
        </div>

        {totals.totalElements === 0 ? (
          <EmptyState />
        ) : (
          <>
            {/* Toolbar */}
            <div style={styles.toolbar}>
              <div style={styles.searchWrap}>
                <i className="fa-solid fa-magnifying-glass" style={styles.searchIcon} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search by name or symbol…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>
              <div style={styles.sortWrap}>
                <label style={styles.sortLabel} htmlFor="sortby">Sort by</label>
                <select
                  id="sortby"
                  value={sortKey}
                  onChange={(e) => { setSortKey(e.target.value); setSortDir("asc"); }}
                  style={styles.select}
                >
                  {COLUMNS.map((c) => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}
                  style={styles.dirBtn}
                  title={sortDir === "asc" ? "Ascending" : "Descending"}
                  aria-label="Toggle sort direction"
                >
                  <i className={`fa-solid ${sortDir === "asc" ? "fa-arrow-up-short-wide" : "fa-arrow-down-wide-short"}`} />
                </button>
              </div>
              <a href="/app/cabinet/collection-export" download style={styles.exportBtn}>
                <i className="fa-solid fa-file-csv" aria-hidden="true" /> Export CSV
              </a>
            </div>

            {/* Table */}
            <div style={styles.tableCard}>
              <div style={styles.tableScroll}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={{ ...styles.th, width: 36 }} aria-hidden="true" />
                      {COLUMNS.map((c) => (
                        <th
                          key={c.key}
                          style={{ ...styles.th, textAlign: c.align || "left", cursor: "pointer" }}
                          onClick={() => onSort(c.key)}
                        >
                          {c.label}
                          {sortKey === c.key && (
                            <i
                              className={`fa-solid ${sortDir === "asc" ? "fa-caret-up" : "fa-caret-down"}`}
                              style={{ marginLeft: 6, color: "#1976D2" }}
                            />
                          )}
                        </th>
                      ))}
                      <th style={{ ...styles.th, textAlign: "left" }}>Notes</th>
                      <th style={{ ...styles.th, textAlign: "right", width: 70 }}>Edit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((r) => {
                      const isOpen = expanded.has(r.symbol);
                      return (
                        <FragmentRow
                          key={r.symbol}
                          row={r}
                          isOpen={isOpen}
                          onToggle={() => toggleRow(r.symbol)}
                          onEdit={() => setEditRow(r)}
                        />
                      );
                    })}
                    {visible.length === 0 && (
                      <tr>
                        <td colSpan={COLUMNS.length + 3} style={styles.noMatch}>
                          No elements match “{query}”.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>

      {editRow && (
        <NotesModal
          key={editRow.symbol}
          element={{ z: editRow.atomicNumber, sym: editRow.symbol, name: editRow.name }}
          samples={editRow.editSamples}
          onClose={() => setEditRow(null)}
          onSaved={() => setEditRow(null)}
        />
      )}
    </div>
  );
}

function FragmentRow({ row, isOpen, onToggle, onEdit }) {
  return (
    <>
      <tr style={{ ...styles.tr, background: isOpen ? "#f5f8ff" : "#fff" }} onClick={onToggle}>
        <td style={styles.tdChevron}>
          <i
            className="fa-solid fa-chevron-right"
            style={{ transition: "transform 0.15s", transform: isOpen ? "rotate(90deg)" : "none", color: "#888" }}
          />
        </td>
        <td style={styles.td}>
          <div style={styles.elCell}>
            <span style={styles.elTile}>
              <span style={styles.elTileNum}>{row.atomicNumber}</span>
              <span style={styles.elTileSym}>{row.symbol}</span>
            </span>
            <span style={styles.elName}>{row.name}</span>
          </div>
        </td>
        <td style={styles.td}>{row.formatsLabel}</td>
        <td style={styles.td}>{row.conditionLabel}</td>
        <td style={{ ...styles.td, textAlign: "center" }}>
          <span style={styles.countBadge}>{row.sampleCount}</span>
        </td>
        <td style={styles.td}>{row.earliestAcquiredFmt}</td>
        <td style={{ ...styles.td, textAlign: "right", fontWeight: 600 }}>{row.totalPaidLabel}</td>
        <td style={styles.td} title={row.notesCombined || ""}>
          <span style={styles.notesCell}>{row.notesPreview}</span>
        </td>
        <td style={{ ...styles.td, textAlign: "right" }}>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onEdit(); }}
            style={styles.editBtn}
            title="Edit acquisition details"
            aria-label={`Edit ${row.name}`}
          >
            <i className="fa-solid fa-pen" />
          </button>
        </td>
      </tr>
      {isOpen && (
        <tr>
          <td colSpan={9} style={styles.subRowCell}>
            {row.samples.length === 0 ? (
              <div style={styles.noSamples}>No sample details recorded yet.</div>
            ) : (
              <div style={styles.sampleGrid}>
                {row.samples.map((s, i) => (
                  <div key={i} style={styles.sampleCard}>
                    <div style={styles.sampleTitle}>Sample {i + 1}</div>
                    <div style={styles.fieldGrid}>
                      <Field label="Acquisition Date" value={s.acquisitionDateFmt} />
                      <Field label="Source" value={s.source} />
                      <Field label="Price Paid" value={s.pricePaidFmt} />
                      <Field label="Condition" value={s.condition} />
                      <Field label="Format" value={s.format} />
                      <Field label="Storage" value={s.storageLocation} />
                    </div>
                    <Field label="Private Notes" value={s.notes} full />
                  </div>
                ))}
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

function Field({ label, value, full }) {
  return (
    <div style={{ gridColumn: full ? "1 / -1" : "auto" }}>
      <div style={styles.fieldLabel}>{label}</div>
      <div style={styles.fieldValue}>{value}</div>
    </div>
  );
}

function Stat({ label, value, icon }) {
  return (
    <div style={styles.statCard}>
      <div style={styles.statIcon}><i className={`fa-solid ${icon}`} aria-hidden="true" /></div>
      <div>
        <div style={styles.statValue}>{value}</div>
        <div style={styles.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div style={styles.empty}>
      <div style={styles.emptyIcon}><i className="fa-solid fa-box-open" aria-hidden="true" /></div>
      <h2 style={styles.emptyTitle}>You haven't logged any owned elements yet</h2>
      <p style={styles.emptyText}>Start building your collection and your full ledger will appear here.</p>
      <a href="/app/cabinet/collection" style={styles.emptyCta}>Go to Collection →</a>
    </div>
  );
}

/* ─────────────── styles ─────────────── */

const styles = {
  title: { fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 },
  subtitle: { fontSize: 14, color: "#666", margin: "4px 0 0" },

  statStrip: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 14, marginBottom: 22 },
  statCard: { display: "flex", alignItems: "center", gap: 12, background: "#fff", border: "1px solid #e9ecef", borderRadius: 12, padding: "16px 18px" },
  statIcon: { width: 38, height: 38, borderRadius: 10, background: "#eef3fe", color: "#5781D8", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 },
  statValue: { fontSize: 20, fontWeight: 800, color: "#1a1a2e", lineHeight: 1.2 },
  statLabel: { fontSize: 12, color: "#888", marginTop: 2 },

  toolbar: { display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, marginBottom: 14 },
  searchWrap: { position: "relative", flex: "1 1 240px", minWidth: 200 },
  searchIcon: { position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#aaa", fontSize: 13 },
  searchInput: { width: "100%", padding: "9px 12px 9px 34px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit" },
  sortWrap: { display: "flex", alignItems: "center", gap: 8 },
  sortLabel: { fontSize: 12, color: "#888", fontWeight: 600 },
  select: { padding: "9px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, fontFamily: "inherit", background: "#fff", cursor: "pointer" },
  dirBtn: { width: 38, height: 38, borderRadius: 8, border: "1px solid #ddd", background: "#fff", cursor: "pointer", color: "#555" },
  exportBtn: { display: "inline-flex", alignItems: "center", gap: 8, padding: "9px 16px", background: "#5781D8", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" },

  tableCard: { background: "#fff", border: "1px solid #e9ecef", borderRadius: 12, overflow: "hidden" },
  tableScroll: { overflowX: "auto" },
  table: { width: "100%", borderCollapse: "collapse", minWidth: 760 },
  th: { textAlign: "left", padding: "12px 14px", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#999", borderBottom: "1px solid #eee", whiteSpace: "nowrap", userSelect: "none" },
  tr: { cursor: "pointer", borderBottom: "1px solid #f3f3f3" },
  td: { padding: "12px 14px", fontSize: 14, color: "#333", verticalAlign: "middle" },
  tdChevron: { padding: "12px 14px", width: 36, textAlign: "center" },

  elCell: { display: "flex", alignItems: "center", gap: 10 },
  elTile: { display: "inline-flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: 6, border: "1px solid #d1d5db", background: "#f9fafb", flexShrink: 0 },
  elTileNum: { fontSize: 8, color: "#9ca3af", lineHeight: 1 },
  elTileSym: { fontSize: 14, fontWeight: 700, color: "#374151", lineHeight: 1.1 },
  elName: { fontWeight: 600 },

  countBadge: { display: "inline-block", minWidth: 22, padding: "2px 8px", borderRadius: 12, background: "#eef3fe", color: "#5781D8", fontSize: 12, fontWeight: 700 },
  notesCell: { display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden", maxWidth: 240, fontSize: 13, color: "#555", lineHeight: 1.35 },
  editBtn: { width: 32, height: 32, borderRadius: 8, border: "1px solid #d8e0f3", background: "#fff", color: "#5781D8", cursor: "pointer", fontSize: 13 },

  subRowCell: { padding: "0 14px 16px", background: "#f5f8ff", borderBottom: "1px solid #e6eefc" },
  sampleGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 12, paddingTop: 4 },
  sampleCard: { background: "#fff", border: "1px solid #e6eefc", borderRadius: 10, padding: "14px 16px" },
  sampleTitle: { fontSize: 12, fontWeight: 800, textTransform: "uppercase", color: "#5781D8", marginBottom: 10, letterSpacing: 0.3 },
  fieldGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px 16px" },
  fieldLabel: { fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#aaa", marginBottom: 2 },
  fieldValue: { fontSize: 14, color: "#333", marginBottom: 8, wordBreak: "break-word" },

  noSamples: { padding: "14px 0", fontSize: 14, color: "#888", fontStyle: "italic" },
  noMatch: { padding: "24px 14px", textAlign: "center", color: "#999", fontSize: 14 },

  empty: { background: "#fff", border: "1px solid #e9ecef", borderRadius: 12, padding: "56px 24px", textAlign: "center" },
  emptyIcon: { fontSize: 40, color: "#c7d3ea", marginBottom: 14 },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: "#1a1a2e", margin: 0 },
  emptyText: { fontSize: 14, color: "#888", margin: "8px 0 20px" },
  emptyCta: { display: "inline-block", padding: "10px 20px", background: "#5781D8", color: "#fff", borderRadius: 8, fontSize: 14, fontWeight: 700, textDecoration: "none" },
};
