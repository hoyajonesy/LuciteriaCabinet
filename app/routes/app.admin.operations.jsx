/**
 * Admin Operations Dashboard (Phase 2.5)
 * 
 * Enhanced with:
 * - Search/filter bar for assignments
 * - Export (CSV/JSON) for shipment & assignment data
 * - Discount monitoring (red for >20%)
 * - Collection type column
 * - Sequence preview (next 4 shipments)
 * - MRR and grandfathering stats
 * - Light theme
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import StatCard from "../components/StatCard";

import * as db from "../data/mock-db.server";
import { assignNextItem, previewSequence, STRATEGIES } from "../lib/assignment-engine.server";

export const loader = () => {
  const dashStats = db.getDashboardStats();
  const upcomingAssignments = db.getUpcomingAssignments();
  const pendingExceptions = db.getPendingExceptions();
  const products = db.getProducts();
  const customers = db.getCustomers().map((c) => ({
    ...c,
    stats: db.getCustomerStats(c.id),
  }));

  // Run assignment engine for each upcoming subscription with collection type
  const assignmentPreviews = upcomingAssignments.map((a) => {
    const customer = db.getCustomerById(a.customer.id);
    const collectionType = customer?.collectionType || "lucite";
    const ownedIds = db.getOwnedProductIds(a.customer.id);
    const shippedIds = db.getShippedProductIds(a.customer.id);
    const wishlistIds = db.getWishlistProductIds(a.customer.id);
    const prefs = db.getPreferences(a.customer.id) || {};
    const subscription = db.getSubscription(a.customer.id);

    const result = assignNextItem({
      customer: { ...a.customer, collectionType },
      ownedProductIds: ownedIds,
      shippedProductIds: shippedIds,
      preferences: {
        ...prefs,
        preferredCategories: JSON.stringify(prefs.preferredCategories || []),
        excludedCategories: JSON.stringify(prefs.excludedCategories || []),
        preferredFormats: JSON.stringify(prefs.preferredFormats || []),
      },
      wishlistProductIds: wishlistIds,
      allProducts: products,
      strategy: prefs.duplicateHandling === "surprise" ? STRATEGIES.SURPRISE : STRATEGIES.WISHLIST_PRIORITY,
      collectionType,
      subscriptionPrice: subscription?.priceUsd || 79.99,
    });

    // Generate sequence preview (next 4)
    const sequence = previewSequence({
      customer: { ...a.customer, collectionType },
      ownedProductIds: ownedIds,
      shippedProductIds: shippedIds,
      preferences: {
        ...prefs,
        preferredCategories: JSON.stringify(prefs.preferredCategories || []),
        excludedCategories: JSON.stringify(prefs.excludedCategories || []),
        preferredFormats: JSON.stringify(prefs.preferredFormats || []),
      },
      wishlistProductIds: wishlistIds,
      allProducts: products,
      strategy: STRATEGIES.WISHLIST_PRIORITY,
      collectionType,
      subscriptionPrice: subscription?.priceUsd || 79.99,
      count: 4,
    });

    return {
      ...a,
      assignmentResult: result,
      collectionType,
      sequence,
    };
  });

  // Low stock products
  const lowStock = products
    .filter((p) => p.inventoryQty > 0 && p.inventoryQty <= 3)
    .sort((a, b) => a.inventoryQty - b.inventoryQty);

  // High discount shipments from history
  const highDiscountShipments = dashStats.highDiscountShipments || [];

  return json({
    dashStats,
    assignmentPreviews,
    pendingExceptions,
    lowStock,
    customers,
    highDiscountShipments,
  });
};

export default function AdminOperations() {
  const { dashStats, assignmentPreviews, pendingExceptions, lowStock, customers, highDiscountShipments } = useLoaderData();
  const [searchQuery, setSearchQuery] = useState("");

  // Filter assignments by search query
  const filteredAssignments = assignmentPreviews.filter((a) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    const name = `${a.customer.firstName} ${a.customer.lastName}`.toLowerCase();
    const email = (a.customer.email || "").toLowerCase();
    const ct = (a.collectionType || "").toLowerCase();
    const element = a.assignmentResult?.product?.elementSymbol?.toLowerCase() || "";
    const elementName = a.assignmentResult?.product?.elementName?.toLowerCase() || "";
    return name.includes(q) || email.includes(q) || ct.includes(q) || element.includes(q) || elementName.includes(q);
  });

  // Export handlers (lazy import client-only module)
  const handleExportCSV = async () => {
    const { exportCSV, todayStr } = await import("../lib/export-utils.client");
    const columns = [
      { label: "Customer", accessor: (r) => `${r.customer.firstName} ${r.customer.lastName}` },
      { label: "Email", accessor: (r) => r.customer.email || "" },
      { label: "Collection Type", accessor: (r) => r.collectionType },
      { label: "Element", accessor: (r) => r.assignmentResult?.product?.elementSymbol || "N/A" },
      { label: "Product", accessor: (r) => r.assignmentResult?.product?.title || "N/A" },
      { label: "Price", accessor: (r) => r.assignmentResult?.product?.priceUsd?.toFixed(2) || "" },
      { label: "Discount %", accessor: (r) => r.assignmentResult?.discount ? (r.assignmentResult.discount.discountPct * 100).toFixed(1) : "0" },
      { label: "Ship Date", accessor: (r) => r.nextShipmentDate },
      { label: "Status", accessor: (r) => r.assignmentResult?.success ? "Ready" : "Exception" },
    ];
    exportCSV(filteredAssignments, columns, `operations-assignments-${todayStr()}`);
  };

  const handleExportJSON = async () => {
    const { exportJSON, todayStr } = await import("../lib/export-utils.client");
    const data = filteredAssignments.map((a) => ({
      customer: `${a.customer.firstName} ${a.customer.lastName}`,
      email: a.customer.email,
      collectionType: a.collectionType,
      element: a.assignmentResult?.product?.elementSymbol || null,
      product: a.assignmentResult?.product?.title || null,
      price: a.assignmentResult?.product?.priceUsd || null,
      discountPct: a.assignmentResult?.discount?.discountPct || 0,
      shipDate: a.nextShipmentDate,
      status: a.assignmentResult?.success ? "ready" : "exception",
    }));
    exportJSON(data, `operations-assignments-${todayStr()}`);
  };

  return (
    <div>
        <h2 style={styles.title}>Operations Dashboard</h2>
        <p style={styles.subtitle}>Subscription assignment engine control center.</p>

        {/* Dashboard Stats */}
        <div style={styles.statsGrid}>
          <StatCard icon="👥" label="Customers" value={dashStats.totalCustomers} accent="var(--luc-accent)" />
          <StatCard icon="📬" label="Active Subs" value={dashStats.activeSubscriptions} accent="var(--luc-success)" />
          <StatCard icon="💰" label="MRR" value={`$${(dashStats.mrr || 0).toFixed(0)}`} accent="var(--luc-gold)" />
          <StatCard icon="⚠️" label="Exceptions" value={dashStats.pendingExceptions} accent={dashStats.pendingExceptions > 0 ? "var(--luc-danger)" : "var(--luc-success)"} />
          <StatCard icon="🔒" label="Grandfathered" value={dashStats.grandfatheredCount || 0} accent="var(--luc-accent)" />
          <StatCard icon="📦" label="Total Shipped" value={dashStats.totalShipments} accent="var(--luc-text-muted)" />
        </div>

        {/* Collection Type Breakdown */}
        {dashStats.collectionTypeBreakdown && dashStats.collectionTypeBreakdown.length > 0 && (
          <div style={styles.breakdownSection}>
            <h4 style={styles.breakdownTitle}>Collection Type Breakdown</h4>
            <div style={styles.breakdownGrid}>
              {dashStats.collectionTypeBreakdown.map((item) => (
                <div key={item.type} style={styles.breakdownItem}>
                  <span style={styles.breakdownCount}>{item.subscribers}</span>
                  <span style={styles.breakdownLabel}>{item.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--luc-text-muted)' }}>${(item.revenue || 0).toFixed(0)}/mo</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Search + Export Toolbar */}
        <div style={styles.toolbar}>
          <div style={styles.searchWrap}>
            <span style={styles.searchIcon}>🔍</span>
            <input
              type="text"
              placeholder="Search assignments by name, email, collection type, element..."
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
          <p style={styles.filterNote}>Showing {filteredAssignments.length} of {assignmentPreviews.length} assignments</p>
        )}

        {/* High Discount Alert */}
        {highDiscountShipments.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span style={styles.alertDot} />
              High Discount Alerts ({highDiscountShipments.length})
            </h3>
            <div style={styles.discountList}>
              {highDiscountShipments.map((d, i) => (
                <div key={i} style={styles.discountCard}>
                  <span style={styles.discountSymbol}>{d.elementSymbol}</span>
                  <span style={styles.discountCustomer}>{d.customerName}</span>
                  <span style={{
                    ...styles.discountPct,
                    color: d.discountPercent > 30 ? "var(--luc-danger)" : "var(--luc-warning)",
                  }}>
                    {d.discountPercent.toFixed(1)}% off
                  </span>
                  <span style={styles.discountPrices}>
                    Retail: ${d.retailPrice?.toFixed(2)} → Sub: ${d.assignedPrice?.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Exception Queue */}
        {pendingExceptions.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>
              <span style={styles.alertDot} />
              Exception Queue ({pendingExceptions.length})
            </h3>
            <div style={styles.exceptionList}>
              {pendingExceptions.map((exc) => {
                const customer = customers.find((c) => c.id === exc.customerId);
                return (
                  <div key={exc.id} style={styles.exceptionCard}>
                    <div style={styles.excHeader}>
                      <span style={styles.excCustomer}>
                        {customer?.firstName} {customer?.lastName}
                      </span>
                      <span style={{
                        ...styles.excReason,
                        color: exc.reason === "no_eligible_items" ? "var(--luc-danger)" : "var(--luc-warning)",
                      }}>
                        {exc.reason.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p style={styles.excDetails}>{exc.details}</p>
                    <div style={styles.excActions}>
                      <button style={styles.excBtn}>Override Assignment</button>
                      <button style={styles.excBtn}>Skip This Month</button>
                      <button style={styles.excBtn}>Assign Manually</button>
                      <button style={{ ...styles.excBtn, color: "var(--luc-success)" }}>Resolve</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Upcoming Assignments — Auto-approved unless admin intervenes */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>
            Upcoming Subscription Assignments
            <span style={styles.autoNote}>Auto-approved — intervene only if needed</span>
          </h3>
          <div style={styles.assignmentList}>
            {filteredAssignments.map((a) => (
              <div key={a.customer.id} style={styles.assignmentCard}>
                <div style={styles.assignHeader}>
                  <div>
                    <Link
                      to={`/app/admin/customer/${a.customer.id}`}
                      style={styles.customerLink}
                    >
                      {a.customer.firstName} {a.customer.lastName}
                    </Link>
                    <span style={styles.displayName}>{a.customer.displayName}</span>
                    <span style={styles.collectionBadge}>{a.collectionType}</span>
                  </div>
                  <div style={styles.assignDate}>
                    Ships: {new Date(a.nextShipmentDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </div>
                </div>

                <div style={styles.assignStats}>
                  <span>Owned: <strong>{a.ownedCount}</strong></span>
                  <span>Eligible: <strong style={{ color: a.eligibleCount === 0 ? "var(--luc-danger)" : "var(--luc-success)" }}>{a.eligibleCount}</strong></span>
                  <span>Wishlist: <strong>{a.wishlistCount}</strong></span>
                  {a.duplicateRisk && <span style={styles.riskBadge}>⚠️ Low Eligible</span>}
                </div>

                {/* Assignment Preview */}
                <div style={styles.assignPreview}>
                  {a.assignmentResult.success ? (
                    <div style={styles.previewSuccess}>
                      <span style={styles.previewLabel}>Engine Pick:</span>
                      <span style={styles.previewSymbol}>{a.assignmentResult.product.elementSymbol}</span>
                      <span style={styles.previewTitle}>{a.assignmentResult.product.title}</span>
                      <span style={styles.previewPrice}>${a.assignmentResult.product.priceUsd.toFixed(2)}</span>
                      <span style={styles.previewStock}>({a.assignmentResult.product.inventoryQty} in stock)</span>
                      
                      {/* Discount indicator */}
                      {a.assignmentResult.discount && (
                        <span style={{
                          ...styles.discountIndicator,
                          color: a.assignmentResult.discount.exceedsThreshold ? "var(--luc-danger)" : "var(--luc-success)",
                          background: a.assignmentResult.discount.exceedsThreshold ? "#fef2f2" : "#f0fdf4",
                        }}>
                          {(a.assignmentResult.discount.discountPct * 100).toFixed(1)}% discount
                          {a.assignmentResult.discount.exceedsThreshold && " ⚠️"}
                        </span>
                      )}

                      {a.assignmentResult.flags?.length > 0 && (
                        <div style={styles.flagRow}>
                          {a.assignmentResult.flags.map((f) => (
                            <span key={f} style={{
                              ...styles.flag,
                              color: f.includes("discount") ? "var(--luc-danger)" : "var(--luc-warning)",
                            }}>
                              {f === "high_value" ? "💰" : f === "low_stock" ? "📉" : f.includes("discount") ? "⚠️" : "💎"} {f.replace(/_/g, " ")}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={styles.previewFail}>
                      <span style={styles.failIcon}>⚠️</span>
                      <span>{a.assignmentResult.reason}</span>
                    </div>
                  )}
                </div>

                {/* Sequence Preview (next 4) */}
                {a.sequence && a.sequence.length > 0 && (
                  <div style={styles.sequenceSection}>
                    <span style={styles.sequenceLabel}>Next {a.sequence.length} Shipments Preview:</span>
                    <div style={styles.sequenceRow}>
                      {a.sequence.map((s, i) => (
                        <div key={i} style={{
                          ...styles.sequenceItem,
                          borderColor: s.success
                            ? (s.discount?.exceedsThreshold ? "var(--luc-danger)" : "var(--luc-border)")
                            : "var(--luc-danger)",
                        }}>
                          <span style={styles.seqMonth}>Mo {s.month}</span>
                          {s.success ? (
                            <>
                              <span style={styles.seqSymbol}>{s.product.elementSymbol}</span>
                              <span style={styles.seqName}>{s.product.elementName}</span>
                              {s.discount && (
                                <span style={{
                                  fontSize: 9,
                                  color: s.discount.exceedsThreshold ? "var(--luc-danger)" : "var(--luc-text-muted)",
                                  fontWeight: s.discount.exceedsThreshold ? 700 : 400,
                                }}>
                                  {(s.discount.discountPct * 100).toFixed(0)}%
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={styles.seqFail}>✗</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Alternates */}
                {a.assignmentResult.alternates?.length > 0 && (
                  <div style={styles.alternates}>
                    <span style={styles.altLabel}>Alternates:</span>
                    {a.assignmentResult.alternates.map((alt) => (
                      <span key={alt.id} style={styles.altItem}>
                        {alt.elementSymbol} ({alt.inventoryQty})
                      </span>
                    ))}
                  </div>
                )}

                {/* Auto-Approved Status + Optional Admin Actions */}
                <div style={styles.adminActions}>
                  <span style={styles.autoApprovedBadge}>✓ Auto-Approved</span>
                  <button style={styles.substituteBtn}>✏️ Override</button>
                  <button style={styles.substituteBtn}>↔ Substitute</button>
                  <button style={styles.skipBtn2}>⏭ Skip</button>
                  <Link to={`/app/admin/customer/${a.customer.id}`} style={styles.profileBtn}>
                    View Profile →
                  </Link>
                </div>
              </div>
            ))}
            {filteredAssignments.length === 0 && searchQuery && (
              <div style={styles.emptySearch}>
                <span style={{ fontSize: 32 }}>🔍</span>
                <p>No assignments match "<strong>{searchQuery}</strong>"</p>
              </div>
            )}
          </div>
        </div>

        {/* Low Stock Alert */}
        {lowStock.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Low Stock Alert</h3>
            <div style={styles.lowStockGrid}>
              {lowStock.map((p) => (
                <div key={p.id} style={styles.lowStockCard}>
                  <span style={styles.lowStockSymbol}>{p.elementSymbol}</span>
                  <span style={styles.lowStockTitle}>{p.title}</span>
                  <span style={{
                    ...styles.lowStockQty,
                    color: p.inventoryQty === 1 ? "var(--luc-danger)" : "var(--luc-warning)",
                  }}>
                    {p.inventoryQty} left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Customer Overview */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Customer Profiles</h3>
          <div style={styles.customerList}>
            {customers.map((c) => {
              const stats = c.stats;
              return (
                <Link
                  key={c.id}
                  to={`/app/admin/customer/${c.id}`}
                  style={styles.customerCard}
                >
                  <div style={styles.custHeader}>
                    <span style={styles.custName}>{c.firstName} {c.lastName}</span>
                    <span style={styles.custDisplay}>{c.displayName}</span>
                    <span style={styles.custCollection}>{c.collectionType || "lucite"}</span>
                  </div>
                  <div style={styles.custStats}>
                    <span>Collected: {stats.totalCollected}/{stats.totalProducts}</span>
                    <span>Completion: {stats.completionPct}%</span>
                  </div>
                  <div style={styles.custProgressTrack}>
                    <div style={{ ...styles.custProgressFill, width: `${stats.completionPct}%` }} />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
    </div>
  );
}

const styles = {
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 24px" },
  statsGrid: { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 24 },
  breakdownSection: { marginBottom: 32 },
  breakdownTitle: { fontSize: 13, fontWeight: 600, color: "var(--luc-text-muted)", textTransform: "uppercase", marginBottom: 8 },
  breakdownGrid: { display: "flex", gap: 10, flexWrap: "wrap" },
  breakdownItem: {
    display: "flex", flexDirection: "column", alignItems: "center",
    padding: "10px 18px", background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 8, minWidth: 80,
  },
  breakdownCount: { fontSize: 20, fontWeight: 700, color: "var(--luc-accent)" },
  breakdownLabel: { fontSize: 11, color: "var(--luc-text-muted)", textTransform: "capitalize" },
  // Search + Export Toolbar
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
    cursor: "pointer", whiteSpace: "nowrap", transition: "background 0.15s",
  },
  filterNote: { fontSize: 12, color: "var(--luc-text-muted)", margin: "4px 0 16px", fontStyle: "italic" },
  emptySearch: {
    textAlign: "center", padding: "40px 20px", color: "var(--luc-text-muted)", fontSize: 14,
  },
  section: { marginBottom: 36 },
  sectionTitle: {
    fontSize: 16, fontWeight: 700, color: "var(--luc-text)", marginBottom: 16,
    paddingBottom: 8, borderBottom: "1px solid var(--luc-border)", display: "flex", alignItems: "center", gap: 8,
  },
  alertDot: { width: 8, height: 8, borderRadius: "50%", background: "var(--luc-danger)", display: "inline-block" },
  // Discount alerts
  discountList: { display: "flex", flexDirection: "column", gap: 8 },
  discountCard: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
    background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
  },
  discountSymbol: { fontSize: 18, fontWeight: 800, color: "var(--luc-danger)" },
  discountCustomer: { fontSize: 13, color: "var(--luc-text)", fontWeight: 500 },
  discountPct: { fontSize: 13, fontWeight: 700, marginLeft: "auto" },
  discountPrices: { fontSize: 11, color: "var(--luc-text-muted)" },
  // Exception Cards
  exceptionList: { display: "flex", flexDirection: "column", gap: 12 },
  exceptionCard: {
    background: "#ffffff", border: "1px solid var(--luc-danger)",
    borderLeft: "4px solid var(--luc-danger)", borderRadius: 10, padding: 16,
  },
  excHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  excCustomer: { fontSize: 15, fontWeight: 700, color: "var(--luc-text)" },
  excReason: { fontSize: 12, fontWeight: 600, textTransform: "uppercase" },
  excDetails: { fontSize: 13, color: "var(--luc-text-muted)", margin: "0 0 12px", lineHeight: 1.5 },
  excActions: { display: "flex", gap: 8 },
  excBtn: {
    padding: "5px 12px", borderRadius: 6, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-text-muted)", fontSize: 12, cursor: "pointer",
  },
  // Assignment Cards
  assignmentList: { display: "flex", flexDirection: "column", gap: 16 },
  assignmentCard: {
    background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 12, padding: 20, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  assignHeader: { display: "flex", justifyContent: "space-between", marginBottom: 12 },
  customerLink: { fontSize: 16, fontWeight: 700, color: "var(--luc-accent)", textDecoration: "none" },
  displayName: { fontSize: 12, color: "var(--luc-text-muted)", marginLeft: 8 },
  collectionBadge: {
    fontSize: 10, fontWeight: 600, color: "var(--luc-accent)",
    background: "#EBF3FC", padding: "2px 8px", borderRadius: 4, marginLeft: 6, textTransform: "capitalize",
  },
  assignDate: { fontSize: 13, color: "var(--luc-text-muted)" },
  assignStats: { display: "flex", gap: 16, fontSize: 13, color: "var(--luc-text-muted)", marginBottom: 12 },
  riskBadge: { color: "var(--luc-warning)", fontWeight: 600 },
  assignPreview: { marginBottom: 12 },
  previewSuccess: {
    display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
    padding: 12, background: "#f8fafc", borderRadius: 8,
  },
  previewLabel: { fontSize: 11, color: "var(--luc-text-muted)", fontWeight: 600, textTransform: "uppercase" },
  previewSymbol: { fontSize: 20, fontWeight: 800, color: "var(--luc-accent)" },
  previewTitle: { fontSize: 14, fontWeight: 500, color: "var(--luc-text)" },
  previewPrice: { fontSize: 14, fontWeight: 700, color: "var(--luc-gold)" },
  previewStock: { fontSize: 12, color: "var(--luc-text-muted)" },
  discountIndicator: {
    fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 4,
  },
  flagRow: { display: "flex", gap: 6, width: "100%", marginTop: 4 },
  flag: { fontSize: 11, background: "#f9fafb", padding: "2px 8px", borderRadius: 4 },
  previewFail: {
    display: "flex", alignItems: "center", gap: 8, padding: 12,
    background: "#fef2f2", borderRadius: 8, fontSize: 13, color: "var(--luc-danger)",
  },
  failIcon: { fontSize: 18 },
  // Sequence Preview
  sequenceSection: { marginBottom: 12 },
  sequenceLabel: { fontSize: 11, color: "var(--luc-text-muted)", fontWeight: 600, display: "block", marginBottom: 6 },
  sequenceRow: { display: "flex", gap: 8, flexWrap: "wrap" },
  sequenceItem: {
    display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
    padding: "8px 12px", background: "#f8fafc", border: "1px solid",
    borderRadius: 8, minWidth: 64,
  },
  seqMonth: { fontSize: 9, color: "var(--luc-text-muted)", fontWeight: 600, textTransform: "uppercase" },
  seqSymbol: { fontSize: 18, fontWeight: 800, color: "var(--luc-accent)" },
  seqName: { fontSize: 9, color: "var(--luc-text-muted)", textAlign: "center", maxWidth: 60, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  seqFail: { fontSize: 18, color: "var(--luc-danger)" },
  alternates: { display: "flex", alignItems: "center", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  altLabel: { fontSize: 11, color: "var(--luc-text-muted)", fontWeight: 600 },
  altItem: {
    fontSize: 12, padding: "2px 8px", background: "#f0f2f5",
    borderRadius: 4, color: "var(--luc-text-muted)",
  },
  adminActions: { display: "flex", gap: 8, paddingTop: 12, borderTop: "1px solid var(--luc-border)" },
  autoApprovedBadge: {
    display: "inline-flex", alignItems: "center", gap: 4,
    padding: "5px 12px", borderRadius: 6, border: "1px solid #86efac",
    background: "#f0fdf4", color: "#15803d", fontSize: 12, fontWeight: 600,
  },
  autoNote: {
    display: "inline-block", marginLeft: 12, fontSize: 12, fontWeight: 400,
    color: "var(--luc-text-muted)", fontStyle: "italic",
  },
  substituteBtn: {
    padding: "6px 14px", borderRadius: 6, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-text)", fontSize: 12, cursor: "pointer",
  },
  skipBtn2: {
    padding: "6px 14px", borderRadius: 6, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-warning)", fontSize: 12, cursor: "pointer",
  },
  profileBtn: {
    marginLeft: "auto", fontSize: 12, color: "var(--luc-accent)", textDecoration: "none",
  },
  // Low Stock
  lowStockGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  lowStockCard: {
    display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 8,
  },
  lowStockSymbol: { fontSize: 18, fontWeight: 800, color: "var(--luc-accent)" },
  lowStockTitle: { fontSize: 12, color: "var(--luc-text)" },
  lowStockQty: { fontSize: 12, fontWeight: 700, marginLeft: "auto" },
  // Customer List
  customerList: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 },
  customerCard: {
    display: "block", background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 10, padding: 16, textDecoration: "none", transition: "border-color 0.15s",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  custHeader: { marginBottom: 8 },
  custName: { fontSize: 15, fontWeight: 700, color: "var(--luc-text)" },
  custDisplay: { fontSize: 12, color: "var(--luc-text-muted)", marginLeft: 6 },
  custCollection: {
    fontSize: 10, fontWeight: 600, color: "var(--luc-accent)",
    background: "#EBF3FC", padding: "1px 6px", borderRadius: 4, marginLeft: 6,
  },
  custStats: { display: "flex", gap: 12, fontSize: 12, color: "var(--luc-text-muted)", marginBottom: 8 },
  custProgressTrack: { height: 4, background: "#e5e7eb", borderRadius: 2 },
  custProgressFill: { height: "100%", background: "var(--luc-accent)", borderRadius: 2, transition: "width 0.5s ease" },
};
