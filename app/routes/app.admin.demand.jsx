/**
 * Admin Demand Insights — /app/admin/demand
 *
 * Out-of-stock watchlist and high-demand items analysis.
 * CSV export for restocking and demand analysis.
 */
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState } from "react";
import {
  getOutOfStockWatchlist,
  getHighDemandItems,
  exportRestockCSV,
  exportDemandDataCSV,
} from "../lib/admin.server.js";
import { getContextDistribution, CONTEXT_LABELS } from "../lib/wishlist-context.server.js";

export const loader = async () => {
  const [outOfStock, highDemand, contextDist] = await Promise.all([
    getOutOfStockWatchlist(),
    getHighDemandItems(),
    getContextDistribution(),
  ]);

  // Build a render-ready breakdown so the client never imports the server module.
  const contextBreakdown = Object.entries(CONTEXT_LABELS).map(([key, meta]) => ({
    key,
    label: meta.label,
    color: meta.color,
    description: meta.description,
    count: contextDist[key] || 0,
  }));
  contextBreakdown.push({
    key: "UNLABELED",
    label: "Unlabeled",
    color: "#9e9e9e",
    description: "No context detected yet",
    count: contextDist.UNLABELED || 0,
  });

  return json({ outOfStock, highDemand, contextBreakdown });
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const intent = formData.get("intent");
  const exportType = formData.get("exportType");

  if (intent === "export") {
    let csv, filename;
    if (exportType === "restock") {
      csv = await exportRestockCSV();
      filename = `luciteria-restock-${new Date().toISOString().split('T')[0]}.csv`;
    } else {
      csv = await exportDemandDataCSV();
      filename = `luciteria-demand-${new Date().toISOString().split('T')[0]}.csv`;
    }

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  return json({ ok: true });
};

export default function AdminDemand() {
  const { outOfStock, highDemand, contextBreakdown } = useLoaderData();
  const totalContext = contextBreakdown.reduce((s, c) => s + c.count, 0);
  const [stockSort, setStockSort] = useState("waitlist"); // waitlist | days
  const [demandSort, setDemandSort] = useState("wishlist"); // wishlist | missing

  const sortedStock = [...outOfStock].sort((a, b) => {
    if (stockSort === "days") return (b.daysOutOfStock || 0) - (a.daysOutOfStock || 0);
    return b.waitlistCount - a.waitlistCount;
  });

  const sortedDemand = [...highDemand].sort((a, b) => {
    if (demandSort === "missing") return b.missingFromCollections - a.missingFromCollections;
    return b.wishlistCount - a.wishlistCount;
  });

  return (
    <div>
      {/* ─── Section 0: Wishlist Context Distribution ─── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>🎯 Wishlist Context Mix</h3>
          <span style={styles.sortLabel}>{totalContext} wishlisted item{totalContext !== 1 ? "s" : ""}</span>
        </div>
        <div style={styles.card}>
          {totalContext === 0 ? (
            <div style={styles.empty}>No wishlist items to analyze yet</div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 16, padding: 4 }}>
              {contextBreakdown.map((c) => {
                const pct = totalContext > 0 ? Math.round((c.count / totalContext) * 100) : 0;
                return (
                  <div key={c.key} style={{ flex: "1 1 160px", minWidth: 160 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#1a1a2e" }}>{c.label}</span>
                      <span style={{ marginLeft: "auto", fontSize: 13, fontWeight: 700 }}>{c.count}</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 3, background: "#eee", overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: c.color }} />
                    </div>
                    <div style={{ fontSize: 11, color: "#888", marginTop: 4 }}>{c.description}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ─── Section 1: Out-of-Stock Watchlist ─── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>📦 Out-of-Stock Watchlist</h3>
          <div style={styles.sectionActions}>
            <div style={styles.sortGroup}>
              <span style={styles.sortLabel}>Sort:</span>
              <button
                onClick={() => setStockSort("waitlist")}
                style={{ ...styles.sortBtn, ...(stockSort === "waitlist" ? styles.sortBtnActive : {}) }}
              >
                Waitlist
              </button>
              <button
                onClick={() => setStockSort("days")}
                style={{ ...styles.sortBtn, ...(stockSort === "days" ? styles.sortBtnActive : {}) }}
              >
                Days OOS
              </button>
            </div>
            <form method="post" style={{ display: 'inline' }}>
              <input type="hidden" name="intent" value="export" />
              <input type="hidden" name="exportType" value="restock" />
              <button type="submit" style={styles.exportBtn}>📥 Export for Restocking</button>
            </form>
          </div>
        </div>

        <div style={styles.card}>
          {sortedStock.length === 0 ? (
            <div style={styles.empty}>No out-of-stock items in watchlists</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>SKU</th>
                  <th style={styles.th}>Element</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Waitlist</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Days OOS</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedStock.map((item, i) => (
                  <tr key={item.sku} style={i % 2 === 0 ? {} : styles.altRow}>
                    <td style={styles.td}>
                      <span style={styles.sku}>{item.sku}</span>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.symbol}>{item.elementSymbol}</span>{' '}
                      <span style={styles.elName}>{item.elementName}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <span style={styles.waitlistBadge}>{item.waitlistCount}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <span style={{
                        color: item.daysOutOfStock > 30 ? '#c62828' : item.daysOutOfStock > 14 ? '#e65100' : '#333',
                        fontWeight: item.daysOutOfStock > 30 ? 700 : 400,
                      }}>
                        {item.daysOutOfStock}d
                      </span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{
                        ...styles.stockBadge,
                        background: item.inStock ? '#e8f5e9' : '#fbe9e7',
                        color: item.inStock ? '#2e7d32' : '#c62828',
                      }}>
                        {item.inStock ? '✓ In Stock' : '✗ Out of Stock'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Section 2: High-Demand Items ─── */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h3 style={styles.sectionTitle}>🔥 High-Demand Items</h3>
          <div style={styles.sectionActions}>
            <div style={styles.sortGroup}>
              <span style={styles.sortLabel}>Sort:</span>
              <button
                onClick={() => setDemandSort("wishlist")}
                style={{ ...styles.sortBtn, ...(demandSort === "wishlist" ? styles.sortBtnActive : {}) }}
              >
                Wishlist
              </button>
              <button
                onClick={() => setDemandSort("missing")}
                style={{ ...styles.sortBtn, ...(demandSort === "missing" ? styles.sortBtnActive : {}) }}
              >
                Missing
              </button>
            </div>
            <form method="post" style={{ display: 'inline' }}>
              <input type="hidden" name="intent" value="export" />
              <input type="hidden" name="exportType" value="demand" />
              <button type="submit" style={styles.exportBtn}>📥 Export Demand Data</button>
            </form>
          </div>
        </div>

        <div style={styles.card}>
          {sortedDemand.length === 0 ? (
            <div style={styles.empty}>No demand data available</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>SKU</th>
                  <th style={styles.th}>Element</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Wishlist Count</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Missing From</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Demand Score</th>
                </tr>
              </thead>
              <tbody>
                {sortedDemand.map((item, i) => {
                  const demandScore = item.wishlistCount + Math.floor(item.missingFromCollections * 0.5);
                  return (
                    <tr key={item.sku} style={i % 2 === 0 ? {} : styles.altRow}>
                      <td style={styles.td}>
                        <span style={styles.sku}>{item.sku}</span>
                      </td>
                      <td style={styles.td}>
                        <span style={styles.symbol}>{item.elementSymbol}</span>{' '}
                        <span style={styles.elName}>{item.elementName}</span>
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>
                        {item.wishlistCount}
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        {item.missingFromCollections} collections
                      </td>
                      <td style={{ ...styles.td, textAlign: 'right' }}>
                        <span style={{
                          ...styles.demandBadge,
                          background: demandScore > 50 ? '#fbe9e7' : demandScore > 20 ? '#fff3e0' : '#e8f5e9',
                          color: demandScore > 50 ? '#c62828' : demandScore > 20 ? '#e65100' : '#2e7d32',
                        }}>
                          {demandScore}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Summary Card ─── */}
      <div style={styles.summaryCard}>
        <h4 style={styles.summaryTitle}>📋 Demand Summary</h4>
        <div style={styles.summaryGrid}>
          <div style={styles.summaryItem}>
            <div style={styles.summaryValue}>{outOfStock.length}</div>
            <div style={styles.summaryLabel}>Elements on watchlists</div>
          </div>
          <div style={styles.summaryItem}>
            <div style={styles.summaryValue}>
              {outOfStock.reduce((sum, i) => sum + i.waitlistCount, 0)}
            </div>
            <div style={styles.summaryLabel}>Total waitlist entries</div>
          </div>
          <div style={styles.summaryItem}>
            <div style={styles.summaryValue}>{highDemand.length}</div>
            <div style={styles.summaryLabel}>High-demand elements</div>
          </div>
          <div style={styles.summaryItem}>
            <div style={styles.summaryValue}>
              {outOfStock.filter(i => !i.inStock).length}
            </div>
            <div style={styles.summaryLabel}>Currently out of stock</div>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
    margin: 0,
  },
  sectionActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexWrap: 'wrap',
  },
  sortGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    background: '#fff',
    border: '1px solid var(--luc-border, #e0e0e0)',
    borderRadius: 6,
    padding: '2px 4px',
  },
  sortLabel: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #888)',
    padding: '0 6px',
  },
  sortBtn: {
    padding: '4px 10px',
    borderRadius: 4,
    border: 'none',
    background: 'transparent',
    color: 'var(--luc-text-muted, #666)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  sortBtnActive: {
    background: '#f0f4ff',
    color: '#2563eb',
    fontWeight: 600,
  },
  exportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fff',
    color: 'var(--luc-text, #1a1a1a)',
    fontSize: 12,
    fontWeight: 500,
    cursor: 'pointer',
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid var(--luc-border, #e0e0e0)',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    fontSize: 13,
  },
  th: {
    textAlign: 'left',
    padding: '10px 14px',
    fontWeight: 600,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--luc-text-muted, #888)',
    borderBottom: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fafafa',
  },
  td: {
    padding: '10px 14px',
    borderBottom: '1px solid #f5f5f5',
  },
  altRow: {
    background: '#fafafa',
  },
  sku: {
    fontFamily: 'monospace',
    fontSize: 12,
    color: 'var(--luc-text-muted, #666)',
    background: '#f5f5f5',
    padding: '2px 6px',
    borderRadius: 4,
  },
  symbol: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4ff',
    color: '#2563eb',
    fontWeight: 700,
    fontSize: 12,
    borderRadius: 4,
    padding: '2px 6px',
    minWidth: 28,
  },
  elName: {
    color: 'var(--luc-text-muted, #666)',
    fontSize: 12,
  },
  waitlistBadge: {
    display: 'inline-block',
    background: '#fff3e0',
    color: '#e65100',
    borderRadius: 10,
    padding: '2px 8px',
    fontSize: 12,
    fontWeight: 600,
  },
  stockBadge: {
    display: 'inline-block',
    borderRadius: 10,
    padding: '2px 8px',
    fontSize: 11,
    fontWeight: 600,
  },
  demandBadge: {
    display: 'inline-block',
    borderRadius: 10,
    padding: '2px 10px',
    fontSize: 12,
    fontWeight: 700,
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: 'var(--luc-text-muted, #888)',
    fontSize: 14,
  },
  summaryCard: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid var(--luc-border, #e0e0e0)',
    padding: '20px 24px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  summaryTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
    margin: '0 0 14px',
  },
  summaryGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 16,
  },
  summaryItem: {
    textAlign: 'center',
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--luc-accent, #2563eb)',
  },
  summaryLabel: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #888)',
    marginTop: 4,
  },
};
