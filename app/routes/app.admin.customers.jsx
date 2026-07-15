/**
 * Admin Customers List (Phase 2.5) — search, filter, export
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import ProgressBar from "../components/ProgressBar";

import * as db from "../data/mock-db.server";

export const loader = () => {
  const customers = db.getCustomers();
  const customerData = customers.map((c) => ({
    ...c,
    stats: db.getCustomerStats(c.id),
    subscription: db.getSubscription(c.id),
    preferences: db.getPreferences(c.id),
  }));
  return json({ customers: customerData });
};

export default function AdminCustomers() {
  const { customers } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = customers.filter((c) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${c.firstName} ${c.lastName}`.toLowerCase();
    const email = (c.email || "").toLowerCase();
    const ct = (c.collectionType || "").toLowerCase();
    const plan = (c.subscription?.planName || "").toLowerCase();
    const id = (c.id || "").toLowerCase();
    const status = (c.subscription?.status || "").toLowerCase();
    return name.includes(q) || email.includes(q) || ct.includes(q) || plan.includes(q) || id.includes(q) || status.includes(q);
  });

  const handleExportCSV = async () => {
    const { exportCSV, todayStr } = await import("../lib/export-utils.client");
    const columns = [
      { label: "ID", accessor: (r) => r.id },
      { label: "Name", accessor: (r) => `${r.firstName} ${r.lastName}` },
      { label: "Email", accessor: (r) => r.email },
      { label: "Collection Type", accessor: (r) => r.collectionType || "lucite" },
      { label: "Plan", accessor: (r) => r.subscription?.planName || "" },
      { label: "Status", accessor: (r) => r.subscription?.status || "" },
      { label: "Price/mo", accessor: (r) => r.subscription?.priceUsd?.toFixed(2) || "" },
      { label: "Collected", accessor: (r) => r.stats?.totalCollected || 0 },
      { label: "Completion %", accessor: (r) => r.stats?.completionPct || 0 },
      { label: "Shipments", accessor: (r) => r.stats?.totalShipments || 0 },
      { label: "Wishlist", accessor: (r) => r.stats?.wishlistCount || 0 },
      { label: "Dupe Handling", accessor: (r) => r.preferences?.duplicateHandling || "" },
    ];
    exportCSV(filtered, columns, `customers-${todayStr()}`);
  };

  const handleExportJSON = async () => {
    const { exportJSON, todayStr } = await import("../lib/export-utils.client");
    const data = filtered.map((c) => ({
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      collectionType: c.collectionType,
      plan: c.subscription?.planName,
      status: c.subscription?.status,
      pricePerMonth: c.subscription?.priceUsd,
      collected: c.stats?.totalCollected,
      completionPct: c.stats?.completionPct,
      shipments: c.stats?.totalShipments,
      wishlist: c.stats?.wishlistCount,
    }));
    exportJSON(data, `customers-${todayStr()}`);
  };

  return (
    <div>
        <h2 style={styles.title}>Customer Profiles</h2>
        <p style={styles.subtitle}>Full view of all collector profiles and their collection status.</p>

        {/* Search + Export Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search by name, email, ID, collection type, plan, status..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={styles.searchInput}
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} style={styles.clearBtn}>✕</button>
            )}
          </div>
          <div style={styles.exportBtns}>
            <button onClick={handleExportCSV} style={styles.exportBtn}>📥 CSV</button>
            <button onClick={handleExportJSON} style={styles.exportBtn}>📥 JSON</button>
          </div>
        </div>
        {searchQuery && (
          <p style={styles.filterNote}>
            Showing {filtered.length} of {customers.length} customers
          </p>
        )}

        <div style={styles.grid}>
          {filtered.map((c) => (
            <Link key={c.id} to={`/app/admin/customer/${c.id}`} style={styles.card}>
              <div style={styles.cardHeader}>
                <div>
                  <div style={styles.name}>{c.firstName} {c.lastName}</div>
                  <div style={styles.display}>
                    {c.displayName}
                    <span style={styles.ctBadge}>{c.collectionType || "lucite"}</span>
                  </div>
                </div>
                {c.subscription && (
                  <span style={{
                    ...styles.subPill,
                    background: c.subscription.status === "active" ? "#05966915" : "#d9770615",
                    color: c.subscription.status === "active" ? "#059669" : "#d97706",
                  }}>
                    {c.subscription.planName}
                  </span>
                )}
              </div>

              <div style={styles.statsRow}>
                <div style={styles.stat}>
                  <div style={styles.statVal}>{c.stats.totalCollected}</div>
                  <div style={styles.statLbl}>Collected</div>
                </div>
                <div style={styles.stat}>
                  <div style={styles.statVal}>{c.stats.missingCount}</div>
                  <div style={styles.statLbl}>Missing</div>
                </div>
                <div style={styles.stat}>
                  <div style={styles.statVal}>{c.stats.wishlistCount}</div>
                  <div style={styles.statLbl}>Wishlist</div>
                </div>
                <div style={styles.stat}>
                  <div style={styles.statVal}>{c.stats.totalShipments}</div>
                  <div style={styles.statLbl}>Shipped</div>
                </div>
              </div>

              <ProgressBar
                value={c.stats.totalCollected}
                max={118}
                label="Completion"
                accent={c.stats.totalCollected >= 118 ? "var(--luc-gold)" : "var(--luc-accent)"}
              />

              <div style={styles.cardMeta}>
                <span>{c.email}</span>
                {c.preferences && (
                  <span>Dupes: {c.preferences.duplicateHandling}</span>
                )}
              </div>
            </Link>
          ))}
          {filtered.length === 0 && searchQuery && (
            <div style={styles.emptySearch}>
              <span style={{ fontSize: 32 }}>🔍</span>
              <p>No customers match "<strong>{searchQuery}</strong>"</p>
            </div>
          )}
        </div>
      
    </div>
  );
}

const styles = {
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 24px" },
  // Toolbar
  toolbar: {
    display: "flex", gap: 12, alignItems: "center", marginBottom: 8,
    padding: "12px 16px", background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 10, flexWrap: "wrap",
  },
  searchWrap: {
    display: "flex", alignItems: "center", flex: 1, minWidth: 260,
    background: "#f8fafc", border: "1px solid var(--luc-border)", borderRadius: 8,
    padding: "0 12px",
  },
  searchIcon: { fontSize: 14, marginRight: 8, opacity: 0.5 },
  searchInput: {
    flex: 1, border: "none", background: "transparent", padding: "10px 0",
    fontSize: 13, color: "var(--luc-text)", outline: "none",
  },
  clearBtn: {
    border: "none", background: "transparent", cursor: "pointer", fontSize: 14,
    color: "var(--luc-text-muted)", padding: "4px 8px",
  },
  exportBtns: { display: "flex", gap: 6 },
  exportBtn: {
    padding: "8px 14px", borderRadius: 6, border: "1px solid var(--luc-border)",
    background: "#ffffff", color: "var(--luc-text)", fontSize: 12, fontWeight: 500,
    cursor: "pointer", whiteSpace: "nowrap",
  },
  filterNote: { fontSize: 12, color: "var(--luc-text-muted)", margin: "4px 0 16px", fontStyle: "italic" },
  emptySearch: {
    textAlign: "center", padding: "40px 20px", color: "var(--luc-text-muted)", fontSize: 14,
    gridColumn: "1 / -1",
  },
  // Grid
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 },
  card: {
    display: "block", background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 12, padding: 20, textDecoration: "none", transition: "border-color 0.15s ease",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 },
  name: { fontSize: 16, fontWeight: 700, color: "var(--luc-text)" },
  display: { fontSize: 12, color: "var(--luc-text-muted)" },
  ctBadge: {
    fontSize: 10, fontWeight: 600, color: "var(--luc-accent)",
    background: "#EBF3FC", padding: "1px 6px", borderRadius: 4, marginLeft: 6,
  },
  subPill: { padding: "3px 8px", borderRadius: 6, fontSize: 11, fontWeight: 600 },
  statsRow: { display: "flex", gap: 16, marginBottom: 16 },
  stat: { textAlign: "center" },
  statVal: { fontSize: 20, fontWeight: 700, color: "var(--luc-text)" },
  statLbl: { fontSize: 10, color: "var(--luc-text-muted)", textTransform: "uppercase" },
  cardMeta: { display: "flex", justifyContent: "space-between", marginTop: 12, fontSize: 11, color: "var(--luc-text-muted)" },
};
