/**
 * Admin Pricing Configuration (Phase 2.5)
 * 
 * Configure subscription prices per collection type, manage pricing tiers,
 * grandfathering durations, and view price change history.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData } from "@remix-run/react";
import { useState } from "react";

import * as db from "../data/mock-db.server";

// Mock pricing data
const PRICING_CONFIG = {
  "10mm": { monthly: 49.99, quarterly: 139.99, annual: 499.99, grandfatherMonths: 12 },
  "25.4mm": { monthly: 69.99, quarterly: 189.99, annual: 699.99, grandfatherMonths: 12 },
  "50mm": { monthly: 99.99, quarterly: 269.99, annual: 999.99, grandfatherMonths: 6 },
  lucite: { monthly: 79.99, quarterly: 219.99, annual: 799.99, grandfatherMonths: 12 },
  ampoules: { monthly: 59.99, quarterly: 159.99, annual: 579.99, grandfatherMonths: 6 },
};

const PRICE_HISTORY = [
  { date: "2026-05-01", type: "lucite", field: "monthly", oldPrice: 74.99, newPrice: 79.99, changedBy: "Admin" },
  { date: "2026-04-15", type: "25.4mm", field: "monthly", oldPrice: 64.99, newPrice: 69.99, changedBy: "Admin" },
  { date: "2026-03-10", type: "ampoules", field: "monthly", oldPrice: 54.99, newPrice: 59.99, changedBy: "Admin" },
  { date: "2026-02-01", type: "50mm", field: "annual", oldPrice: 899.99, newPrice: 999.99, changedBy: "Admin" },
  { date: "2026-01-20", type: "10mm", field: "quarterly", oldPrice: 129.99, newPrice: 139.99, changedBy: "Admin" },
];

export const loader = () => {
  const dashStats = db.getDashboardStats();
  const customers = db.getCustomers();
  const breakdown = dashStats.collectionTypeBreakdown || [];

  // Build subscriber counts per type
  const subscriberCounts = {};
  breakdown.forEach((b) => { subscriberCounts[b.type] = b.subscribers; });

  // Grandfathered customers
  const grandfathered = customers.filter((c) => {
    const sub = db.getSubscription(c.id);
    return sub?.grandfathered;
  }).map((c) => {
    const sub = db.getSubscription(c.id);
    return {
      id: c.id,
      name: `${c.firstName} ${c.lastName}`,
      collectionType: c.collectionType,
      currentPrice: sub?.priceUsd,
      grandfatheredSince: sub?.startDate || "2025-01-01",
    };
  });

  return json({
    pricingConfig: PRICING_CONFIG,
    priceHistory: PRICE_HISTORY,
    subscriberCounts,
    grandfathered,
    grandfatheredCount: dashStats.grandfatheredCount || 0,
    mrr: dashStats.mrr || 0,
  });
};

export const action = async ({ request }) => {
  // Mock save action — in production this would persist to DB
  const formData = await request.formData();
  const type = formData.get("collectionType");
  const monthly = formData.get("monthly");
  const quarterly = formData.get("quarterly");
  const annual = formData.get("annual");
  const grandfatherMonths = formData.get("grandfatherMonths");
  
  // Simulate save
  return json({
    success: true,
    message: `Pricing for ${type} updated: $${monthly}/mo, $${quarterly}/qtr, $${annual}/yr (grandfather: ${grandfatherMonths} mo)`,
  });
};

export default function AdminPricing() {
  const { pricingConfig, priceHistory, subscriberCounts, grandfathered, grandfatheredCount, mrr } = useLoaderData();
  const actionData = useActionData();
  const [editingType, setEditingType] = useState(null);
  const [editValues, setEditValues] = useState({});

  const collectionTypes = Object.keys(pricingConfig);

  const startEditing = (type) => {
    setEditingType(type);
    setEditValues({ ...pricingConfig[type] });
  };

  const cancelEditing = () => {
    setEditingType(null);
    setEditValues({});
  };

  return (
    <div>
        <h2 style={styles.title}>💲 Subscription Pricing Configuration</h2>
        <p style={styles.subtitle}>Manage base prices, tiers, and grandfathering rules per collection type.</p>

        {actionData?.success && (
          <div style={styles.successBanner}>✅ {actionData.message}</div>
        )}

        {/* Summary Stats */}
        <div style={styles.summaryRow}>
          <div style={styles.summaryCard}>
            <div style={styles.summaryVal}>${mrr.toFixed(0)}</div>
            <div style={styles.summaryLbl}>Monthly Recurring Revenue</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryVal}>{grandfatheredCount}</div>
            <div style={styles.summaryLbl}>Grandfathered Customers</div>
          </div>
          <div style={styles.summaryCard}>
            <div style={styles.summaryVal}>{collectionTypes.length}</div>
            <div style={styles.summaryLbl}>Collection Types</div>
          </div>
        </div>

        {/* Pricing Table */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Pricing Tiers by Collection Type</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Collection Type</th>
                  <th style={styles.th}>Subscribers</th>
                  <th style={styles.th}>Monthly</th>
                  <th style={styles.th}>Quarterly</th>
                  <th style={styles.th}>Annual</th>
                  <th style={styles.th}>Grandfather (mo)</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {collectionTypes.map((type) => {
                  const cfg = pricingConfig[type];
                  const isEditing = editingType === type;
                  return (
                    <tr key={type} style={isEditing ? styles.editingRow : {}}>
                      <td style={styles.td}>
                        <span style={styles.typeBadge}>{type}</span>
                      </td>
                      <td style={styles.td}>{subscriberCounts[type] || 0}</td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.monthly}
                            onChange={(e) => setEditValues({ ...editValues, monthly: e.target.value })}
                            style={styles.editInput}
                          />
                        ) : (
                          <span style={styles.price}>${cfg.monthly.toFixed(2)}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.quarterly}
                            onChange={(e) => setEditValues({ ...editValues, quarterly: e.target.value })}
                            style={styles.editInput}
                          />
                        ) : (
                          <span style={styles.price}>${cfg.quarterly.toFixed(2)}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            step="0.01"
                            value={editValues.annual}
                            onChange={(e) => setEditValues({ ...editValues, annual: e.target.value })}
                            style={styles.editInput}
                          />
                        ) : (
                          <span style={styles.price}>${cfg.annual.toFixed(2)}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <input
                            type="number"
                            value={editValues.grandfatherMonths}
                            onChange={(e) => setEditValues({ ...editValues, grandfatherMonths: e.target.value })}
                            style={{ ...styles.editInput, width: 60 }}
                          />
                        ) : (
                          <span>{cfg.grandfatherMonths}</span>
                        )}
                      </td>
                      <td style={styles.td}>
                        {isEditing ? (
                          <div style={{ display: "flex", gap: 4 }}>
                            <Form method="post">
                              <input type="hidden" name="collectionType" value={type} />
                              <input type="hidden" name="monthly" value={editValues.monthly} />
                              <input type="hidden" name="quarterly" value={editValues.quarterly} />
                              <input type="hidden" name="annual" value={editValues.annual} />
                              <input type="hidden" name="grandfatherMonths" value={editValues.grandfatherMonths} />
                              <button type="submit" style={styles.saveBtn} onClick={cancelEditing}>💾 Save</button>
                            </Form>
                            <button onClick={cancelEditing} style={styles.cancelBtn}>Cancel</button>
                          </div>
                        ) : (
                          <button onClick={() => startEditing(type)} style={styles.editBtn}>✏️ Edit</button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Savings Calculator */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Tier Savings Comparison</h3>
          <div style={styles.savingsGrid}>
            {collectionTypes.map((type) => {
              const cfg = pricingConfig[type];
              const qtrSave = ((cfg.monthly * 3 - cfg.quarterly) / (cfg.monthly * 3) * 100).toFixed(0);
              const annSave = ((cfg.monthly * 12 - cfg.annual) / (cfg.monthly * 12) * 100).toFixed(0);
              return (
                <div key={type} style={styles.savingsCard}>
                  <div style={styles.savingsType}>{type}</div>
                  <div style={styles.savingsRow}>
                    <span>Quarterly saves</span>
                    <strong style={{ color: "var(--luc-success)" }}>{qtrSave}%</strong>
                  </div>
                  <div style={styles.savingsRow}>
                    <span>Annual saves</span>
                    <strong style={{ color: "var(--luc-success)" }}>{annSave}%</strong>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Grandfathered Customers */}
        {grandfathered.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>🔒 Grandfathered Customers ({grandfathered.length})</h3>
            <div style={styles.gfList}>
              {grandfathered.map((g) => (
                <div key={g.id} style={styles.gfCard}>
                  <span style={styles.gfName}>{g.name}</span>
                  <span style={styles.gfType}>{g.collectionType}</span>
                  <span style={styles.gfPrice}>${g.currentPrice?.toFixed(2)}/mo</span>
                  <span style={styles.gfSince}>Since {g.grandfatheredSince}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Price Change History */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>📜 Price Change History</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Collection</th>
                  <th style={styles.th}>Tier</th>
                  <th style={styles.th}>Old Price</th>
                  <th style={styles.th}>New Price</th>
                  <th style={styles.th}>Change</th>
                  <th style={styles.th}>By</th>
                </tr>
              </thead>
              <tbody>
                {priceHistory.map((h, i) => {
                  const change = h.newPrice - h.oldPrice;
                  const pct = ((change / h.oldPrice) * 100).toFixed(1);
                  return (
                    <tr key={i}>
                      <td style={styles.td}>{h.date}</td>
                      <td style={styles.td}><span style={styles.typeBadge}>{h.type}</span></td>
                      <td style={styles.td}>{h.field}</td>
                      <td style={styles.td}>${h.oldPrice.toFixed(2)}</td>
                      <td style={styles.td}>${h.newPrice.toFixed(2)}</td>
                      <td style={{
                        ...styles.td,
                        color: change > 0 ? "var(--luc-danger)" : "var(--luc-success)",
                        fontWeight: 600,
                      }}>
                        {change > 0 ? "+" : ""}{pct}%
                      </td>
                      <td style={styles.td}>{h.changedBy}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      
    </div>
  );
}

const styles = {
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 24px" },
  successBanner: {
    padding: "12px 16px", background: "#f0fdf4", border: "1px solid #86efac",
    borderRadius: 8, color: "#15803d", fontSize: 13, fontWeight: 500, marginBottom: 20,
  },
  summaryRow: { display: "flex", gap: 16, marginBottom: 32, flexWrap: "wrap" },
  summaryCard: {
    flex: 1, minWidth: 160, background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 10, padding: "16px 20px", textAlign: "center",
  },
  summaryVal: { fontSize: 28, fontWeight: 800, color: "var(--luc-accent)" },
  summaryLbl: { fontSize: 11, color: "var(--luc-text-muted)", textTransform: "uppercase", marginTop: 4 },
  section: { marginBottom: 36 },
  sectionTitle: {
    fontSize: 16, fontWeight: 700, color: "var(--luc-text)", marginBottom: 16,
    paddingBottom: 8, borderBottom: "1px solid var(--luc-border)",
  },
  tableWrap: { overflowX: "auto" },
  table: {
    width: "100%", borderCollapse: "collapse", background: "#ffffff",
    border: "1px solid var(--luc-border)", borderRadius: 8,
  },
  th: {
    padding: "10px 14px", textAlign: "left", fontSize: 11, fontWeight: 600,
    color: "var(--luc-text-muted)", textTransform: "uppercase", borderBottom: "2px solid var(--luc-border)",
    background: "#f8fafc",
  },
  td: {
    padding: "10px 14px", fontSize: 13, color: "var(--luc-text)",
    borderBottom: "1px solid var(--luc-border)",
  },
  editingRow: { background: "#fffbeb" },
  typeBadge: {
    fontSize: 11, fontWeight: 600, color: "var(--luc-accent)",
    background: "#EBF3FC", padding: "2px 8px", borderRadius: 4, textTransform: "capitalize",
  },
  price: { fontWeight: 600, fontFamily: "monospace" },
  editInput: {
    width: 80, padding: "4px 8px", border: "1px solid var(--luc-accent)",
    borderRadius: 4, fontSize: 13, background: "#ffffff",
  },
  editBtn: {
    padding: "4px 10px", borderRadius: 4, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-accent)", fontSize: 12, cursor: "pointer",
  },
  saveBtn: {
    padding: "4px 10px", borderRadius: 4, border: "1px solid #86efac",
    background: "#f0fdf4", color: "#15803d", fontSize: 12, cursor: "pointer", fontWeight: 600,
  },
  cancelBtn: {
    padding: "4px 10px", borderRadius: 4, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-text-muted)", fontSize: 12, cursor: "pointer",
  },
  savingsGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  savingsCard: {
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 10, padding: 16,
  },
  savingsType: {
    fontSize: 13, fontWeight: 700, color: "var(--luc-accent)", textTransform: "capitalize",
    marginBottom: 8,
  },
  savingsRow: {
    display: "flex", justifyContent: "space-between", fontSize: 12,
    color: "var(--luc-text-muted)", padding: "3px 0",
  },
  gfList: { display: "flex", flexDirection: "column", gap: 8 },
  gfCard: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 16px",
    background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
  },
  gfName: { fontSize: 13, fontWeight: 600, color: "var(--luc-text)" },
  gfType: {
    fontSize: 10, fontWeight: 600, color: "var(--luc-accent)",
    background: "#EBF3FC", padding: "1px 6px", borderRadius: 4,
  },
  gfPrice: { fontSize: 13, fontWeight: 700, color: "var(--luc-gold)", marginLeft: "auto" },
  gfSince: { fontSize: 11, color: "var(--luc-text-muted)" },
};
