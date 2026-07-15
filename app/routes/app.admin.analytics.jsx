/**
 * Admin Analytics Dashboard (Phase 2.5)
 * 
 * KPI cards, collection type breakdown, revenue trends,
 * popular elements, customer completion rates, export all data.
 */
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import StatCard from "../components/StatCard";

import * as db from "../data/mock-db.server";
import { getAdminCollectionMetrics } from "../lib/collection.server";

export const loader = async () => {
  const dashStats = db.getDashboardStats();
  const customers = db.getCustomers();
  const products = db.getProducts();

  // Per-customer analytics
  const customerAnalytics = customers.map((c) => {
    const stats = db.getCustomerStats(c.id);
    const sub = db.getSubscription(c.id);
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      email: c.email,
      collectionType: c.collectionType || "lucite",
      collected: stats.totalCollected,
      totalProducts: stats.totalProducts,
      completionPct: stats.completionPct,
      shipments: stats.totalShipments,
      wishlistCount: stats.wishlistCount,
      missingCount: stats.missingCount,
      status: sub?.status || "unknown",
      priceUsd: sub?.priceUsd || 0,
      planName: sub?.planName || "N/A",
      grandfathered: sub?.grandfathered || false,
    };
  });

  // Product popularity (by shipment count from mock data)
  const productAnalytics = products.map((p) => ({
    id: p.id,
    title: p.title,
    elementSymbol: p.elementSymbol,
    elementName: p.elementName,
    retailPrice: p.retailPrice,
    subscriptionCost: p.subscriptionCost,
    inventoryQty: p.inventoryQty,
    collectionTypes: p.collectionTypes || [],
  })).sort((a, b) => a.inventoryQty - b.inventoryQty); // lowest stock = most shipped

  // Collection type breakdown
  const breakdown = dashStats.collectionTypeBreakdown || [];

  // Avg completion
  const avgCompletion = customerAnalytics.length > 0
    ? (customerAnalytics.reduce((s, c) => s + c.completionPct, 0) / customerAnalytics.length).toFixed(1)
    : 0;

  // Avg price per customer
  const avgPrice = customerAnalytics.length > 0
    ? (customerAnalytics.reduce((s, c) => s + c.priceUsd, 0) / customerAnalytics.length).toFixed(2)
    : 0;

  // Churn (mock: count inactive / paused)
  const churnCount = customerAnalytics.filter((c) => c.status !== "active").length;
  const churnRate = customerAnalytics.length > 0 ? ((churnCount / customerAnalytics.length) * 100).toFixed(1) : 0;

  // Revenue by collection type
  const revenueByType = breakdown.map((b) => ({
    type: b.type,
    label: b.label,
    subscribers: b.subscribers,
    revenue: b.revenue || 0,
    pctOfTotal: dashStats.mrr > 0 ? ((b.revenue || 0) / dashStats.mrr * 100).toFixed(1) : 0,
  }));

  // Mock monthly trend data
  const monthlyTrend = [
    { month: "Jan", mrr: 320, subs: 4, shipments: 4 },
    { month: "Feb", mrr: 340, subs: 5, shipments: 5 },
    { month: "Mar", mrr: 380, subs: 5, shipments: 5 },
    { month: "Apr", mrr: 400, subs: 6, shipments: 7 },
    { month: "May", mrr: dashStats.mrr || 420, subs: dashStats.activeSubscriptions || 6, shipments: dashStats.totalShipments || 8 },
  ];

  // Collection metrics from new collection-first system
  let collectionMetrics = { totalUsers: 0, activeCollectors: 0, stateDistribution: {}, topCollectors: [], mostWantedElements: [] };
  try {
    collectionMetrics = await getAdminCollectionMetrics();
  } catch (e) {
    console.error("Failed to load collection metrics:", e.message);
  }

  return json({
    dashStats,
    customerAnalytics,
    productAnalytics,
    revenueByType,
    avgCompletion,
    avgPrice,
    churnRate,
    churnCount,
    monthlyTrend,
    collectionMetrics,
  });
};

export default function AdminAnalytics() {
  const {
    dashStats, customerAnalytics, productAnalytics, revenueByType,
    avgCompletion, avgPrice, churnRate, churnCount, monthlyTrend,
    collectionMetrics,
  } = useLoaderData();
  const [activeTab, setActiveTab] = useState("overview");

  const handleExportAll = async () => {
    const { exportJSON, todayStr } = await import("../lib/export-utils.client");
    const data = {
      exportDate: new Date().toISOString(),
      kpis: {
        totalCustomers: dashStats.totalCustomers,
        activeSubscriptions: dashStats.activeSubscriptions,
        mrr: dashStats.mrr,
        avgCompletion,
        avgPrice,
        churnRate,
        grandfatheredCount: dashStats.grandfatheredCount,
      },
      revenueByType,
      monthlyTrend,
      customers: customerAnalytics,
      products: productAnalytics,
    };
    exportJSON(data, `analytics-full-export-${todayStr()}`);
  };

  const handleExportCSV = async () => {
    const { exportCSV, todayStr } = await import("../lib/export-utils.client");
    const columns = [
      { label: "Customer", accessor: (r) => r.name },
      { label: "Email", accessor: (r) => r.email },
      { label: "Collection Type", accessor: (r) => r.collectionType },
      { label: "Plan", accessor: (r) => r.planName },
      { label: "Status", accessor: (r) => r.status },
      { label: "Price/mo", accessor: (r) => r.priceUsd.toFixed(2) },
      { label: "Collected", accessor: (r) => r.collected },
      { label: "Completion %", accessor: (r) => r.completionPct },
      { label: "Shipments", accessor: (r) => r.shipments },
      { label: "Grandfathered", accessor: (r) => r.grandfathered ? "Yes" : "No" },
    ];
    exportCSV(customerAnalytics, columns, `analytics-customers-${todayStr()}`);
  };

  const maxMrr = Math.max(...monthlyTrend.map((m) => m.mrr));

  return (
    <div>
        <div style={styles.headerRow}>
          <div>
            <h2 style={styles.title}>📈 Analytics Dashboard</h2>
            <p style={styles.subtitle}>Business intelligence and subscription metrics.</p>
          </div>
          <div style={styles.exportBtns}>
            <button onClick={handleExportCSV} style={styles.exportBtn}>📥 CSV</button>
            <button onClick={handleExportAll} style={styles.exportBtn}>📥 Full JSON</button>
          </div>
        </div>

        {/* KPI Cards */}
        <div style={styles.kpiGrid}>
          <StatCard icon="💰" label="MRR" value={`$${(dashStats.mrr || 0).toFixed(0)}`} accent="var(--luc-gold)" />
          <StatCard icon="📬" label="Active Subs" value={dashStats.activeSubscriptions || 0} accent="var(--luc-success)" />
          <StatCard icon="👥" label="Total Customers" value={dashStats.totalCustomers || 0} accent="var(--luc-accent)" />
          <StatCard icon="📊" label="Avg Completion" value={`${avgCompletion}%`} accent="var(--luc-accent)" />
          <StatCard icon="💵" label="Avg Price/mo" value={`$${avgPrice}`} accent="var(--luc-gold)" />
          <StatCard icon="📉" label="Churn Rate" value={`${churnRate}%`} accent={parseFloat(churnRate) > 10 ? "var(--luc-danger)" : "var(--luc-success)"} />
          <StatCard icon="🔒" label="Grandfathered" value={dashStats.grandfatheredCount || 0} accent="var(--luc-warning)" />
          <StatCard icon="📦" label="Total Shipped" value={dashStats.totalShipments || 0} accent="var(--luc-text-muted)" />
        </div>

        {/* Tab Navigation */}
        <div style={styles.tabs}>
          {["overview", "customers", "products", "revenue", "collection"].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={activeTab === tab ? { ...styles.tab, ...styles.tabActive } : styles.tab}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === "overview" && (
          <>
            {/* MRR Trend (CSS bar chart) */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>MRR Trend (Last 5 Months)</h3>
              <div style={styles.chartWrap}>
                {monthlyTrend.map((m) => (
                  <div key={m.month} style={styles.chartCol}>
                    <div style={styles.chartBarWrap}>
                      <div style={{
                        ...styles.chartBar,
                        height: `${(m.mrr / maxMrr) * 120}px`,
                      }}>
                        <span style={styles.chartBarVal}>${m.mrr}</span>
                      </div>
                    </div>
                    <span style={styles.chartLabel}>{m.month}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Revenue by Collection Type */}
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Revenue by Collection Type</h3>
              <div style={styles.revenueGrid}>
                {revenueByType.map((r) => (
                  <div key={r.type} style={styles.revenueCard}>
                    <div style={styles.revType}>{r.label}</div>
                    <div style={styles.revAmount}>${r.revenue.toFixed(0)}/mo</div>
                    <div style={styles.revSubs}>{r.subscribers} subscribers</div>
                    <div style={styles.revBarTrack}>
                      <div style={{ ...styles.revBarFill, width: `${r.pctOfTotal}%` }} />
                    </div>
                    <div style={styles.revPct}>{r.pctOfTotal}% of MRR</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Customers Tab */}
        {activeTab === "customers" && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Customer Completion Rates</h3>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Customer</th>
                    <th style={styles.th}>Collection</th>
                    <th style={styles.th}>Plan</th>
                    <th style={styles.th}>$/mo</th>
                    <th style={styles.th}>Collected</th>
                    <th style={styles.th}>Completion</th>
                    <th style={styles.th}>Shipments</th>
                    <th style={styles.th}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {customerAnalytics.map((c) => (
                    <tr key={c.id}>
                      <td style={styles.td}>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 11, color: "var(--luc-text-muted)" }}>{c.email}</div>
                      </td>
                      <td style={styles.td}><span style={styles.ctBadge}>{c.collectionType}</span></td>
                      <td style={styles.td}>{c.planName}</td>
                      <td style={styles.td}>${c.priceUsd.toFixed(2)}</td>
                      <td style={styles.td}>{c.collected}/{c.totalProducts}</td>
                      <td style={styles.td}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={styles.miniBarTrack}>
                            <div style={{ ...styles.miniBarFill, width: `${c.completionPct}%` }} />
                          </div>
                          <span style={{ fontSize: 12, fontWeight: 600 }}>{c.completionPct}%</span>
                        </div>
                      </td>
                      <td style={styles.td}>{c.shipments}</td>
                      <td style={styles.td}>
                        <span style={{
                          ...styles.statusPill,
                          background: c.status === "active" ? "#f0fdf4" : "#fef2f2",
                          color: c.status === "active" ? "#059669" : "#dc2626",
                        }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Products Tab */}
        {activeTab === "products" && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Product Inventory & Pricing ({productAnalytics.length} products)</h3>
            <div style={styles.tableWrap}>
              <table style={styles.table}>
                <thead>
                  <tr>
                    <th style={styles.th}>Element</th>
                    <th style={styles.th}>Product</th>
                    <th style={styles.th}>Retail</th>
                    <th style={styles.th}>Sub Cost</th>
                    <th style={styles.th}>Margin</th>
                    <th style={styles.th}>Stock</th>
                    <th style={styles.th}>Collections</th>
                  </tr>
                </thead>
                <tbody>
                  {productAnalytics.map((p) => {
                    const margin = p.retailPrice > 0 ? ((p.retailPrice - p.subscriptionCost) / p.retailPrice * 100).toFixed(0) : 0;
                    return (
                      <tr key={p.id}>
                        <td style={styles.td}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--luc-accent)" }}>{p.elementSymbol}</span>
                          <span style={{ fontSize: 11, color: "var(--luc-text-muted)", marginLeft: 6 }}>{p.elementName}</span>
                        </td>
                        <td style={styles.td}>{p.title}</td>
                        <td style={styles.td}>${p.retailPrice?.toFixed(2)}</td>
                        <td style={styles.td}>${p.subscriptionCost?.toFixed(2)}</td>
                        <td style={{
                          ...styles.td,
                          color: margin > 0 ? "var(--luc-success)" : "var(--luc-danger)",
                          fontWeight: 600,
                        }}>
                          {margin}%
                        </td>
                        <td style={{
                          ...styles.td,
                          color: p.inventoryQty <= 3 ? "var(--luc-danger)" : "var(--luc-text)",
                          fontWeight: p.inventoryQty <= 3 ? 700 : 400,
                        }}>
                          {p.inventoryQty}
                        </td>
                        <td style={styles.td}>
                          {(p.collectionTypes || []).map((ct) => (
                            <span key={ct} style={{ ...styles.ctBadge, marginRight: 4 }}>{ct}</span>
                          ))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Revenue Tab */}
        {activeTab === "revenue" && (
          <>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Monthly Metrics Trend</h3>
              <div style={styles.tableWrap}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Month</th>
                      <th style={styles.th}>MRR</th>
                      <th style={styles.th}>Active Subs</th>
                      <th style={styles.th}>Shipments</th>
                      <th style={styles.th}>ARPU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {monthlyTrend.map((m) => (
                      <tr key={m.month}>
                        <td style={styles.td}>{m.month} 2026</td>
                        <td style={{ ...styles.td, fontWeight: 700, color: "var(--luc-gold)" }}>${m.mrr}</td>
                        <td style={styles.td}>{m.subs}</td>
                        <td style={styles.td}>{m.shipments}</td>
                        <td style={styles.td}>${m.subs > 0 ? (m.mrr / m.subs).toFixed(2) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Revenue Concentration</h3>
              <div style={styles.concGrid}>
                {revenueByType.sort((a, b) => b.revenue - a.revenue).map((r, i) => (
                  <div key={r.type} style={styles.concCard}>
                    <div style={styles.concRank}>#{i + 1}</div>
                    <div style={styles.concType}>{r.label}</div>
                    <div style={styles.concRevenue}>${r.revenue.toFixed(0)}/mo</div>
                    <div style={styles.concPct}>{r.pctOfTotal}% of total</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Collection Tab (new) */}
        {activeTab === "collection" && (
          <>
            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Collection System Metrics</h3>
              <div style={styles.kpiGrid}>
                <StatCard label="Total Users" value={collectionMetrics.totalUsers} />
                <StatCard label="Active Collectors" value={collectionMetrics.activeCollectors} />
                <StatCard label="Owned Items" value={collectionMetrics.stateDistribution.OWNED || 0} />
                <StatCard label="Wanted Items" value={collectionMetrics.stateDistribution.WANTED || 0} />
                <StatCard label="Watchlist Items" value={collectionMetrics.stateDistribution.WATCHLIST || 0} />
              </div>
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Most Wanted Elements</h3>
              {collectionMetrics.mostWantedElements.length === 0 ? (
                <p style={{ color: "#888", fontStyle: "italic" }}>No wanted elements yet.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>Element</th>
                      <th style={styles.th}>Wanted By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionMetrics.mostWantedElements.map((el, i) => (
                      <tr key={el.elementSymbol}>
                        <td style={styles.td}>{i + 1}</td>
                        <td style={styles.td}>{el.elementSymbol}</td>
                        <td style={styles.td}>{el.wantedByCount} users</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div style={styles.section}>
              <h3 style={styles.sectionTitle}>Top Collectors</h3>
              {collectionMetrics.topCollectors.length === 0 ? (
                <p style={{ color: "#888", fontStyle: "italic" }}>No collection data yet.</p>
              ) : (
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>#</th>
                      <th style={styles.th}>User ID</th>
                      <th style={styles.th}>Elements Owned</th>
                    </tr>
                  </thead>
                  <tbody>
                    {collectionMetrics.topCollectors.map((tc, i) => (
                      <tr key={tc.userId}>
                        <td style={styles.td}>{i + 1}</td>
                        <td style={{ ...styles.td, fontSize: 11, fontFamily: "monospace" }}>{tc.userId.slice(0, 8)}...</td>
                        <td style={styles.td}>{tc.ownedCount}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </>
        )}
    </div>
  );
}

const styles = {
  headerRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 0" },
  exportBtns: { display: "flex", gap: 6 },
  exportBtn: {
    padding: "8px 14px", borderRadius: 6, border: "1px solid var(--luc-border)",
    background: "#ffffff", color: "var(--luc-text)", fontSize: 12, fontWeight: 500,
    cursor: "pointer", whiteSpace: "nowrap",
  },
  kpiGrid: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 },
  // Tabs
  tabs: {
    display: "flex", gap: 4, marginBottom: 24, borderBottom: "2px solid var(--luc-border)",
    paddingBottom: 0,
  },
  tab: {
    padding: "10px 20px", border: "none", background: "transparent", fontSize: 13,
    fontWeight: 500, color: "var(--luc-text-muted)", cursor: "pointer", borderBottom: "2px solid transparent",
    marginBottom: -2, transition: "all 0.15s",
  },
  tabActive: {
    color: "var(--luc-accent)", borderBottomColor: "var(--luc-accent)", fontWeight: 700,
  },
  section: { marginBottom: 36 },
  sectionTitle: {
    fontSize: 16, fontWeight: 700, color: "var(--luc-text)", marginBottom: 16,
    paddingBottom: 8, borderBottom: "1px solid var(--luc-border)",
  },
  // Chart
  chartWrap: {
    display: "flex", gap: 16, alignItems: "flex-end", padding: "20px 16px",
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 10,
  },
  chartCol: { display: "flex", flexDirection: "column", alignItems: "center", flex: 1 },
  chartBarWrap: { display: "flex", alignItems: "flex-end", height: 130 },
  chartBar: {
    width: 48, background: "linear-gradient(180deg, var(--luc-accent) 0%, #7BB3F0 100%)",
    borderRadius: "6px 6px 0 0", display: "flex", alignItems: "flex-start", justifyContent: "center",
    paddingTop: 4, minHeight: 20,
  },
  chartBarVal: { fontSize: 10, fontWeight: 700, color: "#ffffff" },
  chartLabel: { fontSize: 12, color: "var(--luc-text-muted)", fontWeight: 500, marginTop: 6 },
  // Revenue grid
  revenueGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 12 },
  revenueCard: {
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 10, padding: 16,
  },
  revType: { fontSize: 13, fontWeight: 700, color: "var(--luc-accent)", textTransform: "capitalize", marginBottom: 4 },
  revAmount: { fontSize: 22, fontWeight: 800, color: "var(--luc-text)" },
  revSubs: { fontSize: 11, color: "var(--luc-text-muted)", marginBottom: 8 },
  revBarTrack: { height: 6, background: "#e5e7eb", borderRadius: 3, marginBottom: 4 },
  revBarFill: { height: "100%", background: "var(--luc-accent)", borderRadius: 3, transition: "width 0.5s" },
  revPct: { fontSize: 11, color: "var(--luc-text-muted)" },
  // Table
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%", borderCollapse: "collapse", background: "#ffffff",
    border: "1px solid var(--luc-border)", borderRadius: 8,
  },
  th: {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
    color: "var(--luc-text-muted)", textTransform: "uppercase",
    borderBottom: "2px solid var(--luc-border)", background: "#f8fafc",
  },
  td: {
    padding: "10px 14px", fontSize: 13, color: "var(--luc-text)",
    borderBottom: "1px solid var(--luc-border)",
  },
  ctBadge: {
    fontSize: 10, fontWeight: 600, color: "var(--luc-accent)",
    background: "#EBF3FC", padding: "1px 6px", borderRadius: 4, textTransform: "capitalize",
  },
  miniBarTrack: { width: 60, height: 4, background: "#e5e7eb", borderRadius: 2 },
  miniBarFill: { height: "100%", background: "var(--luc-accent)", borderRadius: 2 },
  statusPill: { padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  // Concentration
  concGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  concCard: {
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 10, padding: 16,
    textAlign: "center",
  },
  concRank: { fontSize: 11, fontWeight: 700, color: "var(--luc-gold)", marginBottom: 4 },
  concType: { fontSize: 14, fontWeight: 700, color: "var(--luc-text)", textTransform: "capitalize" },
  concRevenue: { fontSize: 20, fontWeight: 800, color: "var(--luc-accent)", margin: "4px 0" },
  concPct: { fontSize: 11, color: "var(--luc-text-muted)" },
};
