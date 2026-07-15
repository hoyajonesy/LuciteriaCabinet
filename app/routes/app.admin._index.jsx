/**
 * Admin Overview Dashboard — /app/admin
 *
 * Shows key metrics, top collected/wanted elements, and recent activity.
 */
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  getAdminOverviewStats,
  getTopCollectedElements,
  getTopWantedElements,
  getRecentActivity,
} from "../lib/admin.server.js";
import MetricCard from "../components/admin/MetricCard.jsx";

export const loader = async () => {
  const [stats, topCollected, topWanted, recentActivity] = await Promise.all([
    getAdminOverviewStats(),
    getTopCollectedElements(10),
    getTopWantedElements(10),
    getRecentActivity(10),
  ]);

  return json({ stats, topCollected, topWanted, recentActivity });
};

export default function AdminOverview() {
  const { stats, topCollected, topWanted, recentActivity } = useLoaderData();

  return (
    <div>
      {/* ─── Metric Cards ─── */}
      <div style={styles.metricsGrid}>
        <MetricCard title="Total Users" value={stats.totalUsers} icon="👥" accent="#2563eb" />
        <MetricCard title="Collections Tracked" value={stats.totalCollections} icon="🧊" accent="#7c3aed" />
        <MetricCard title="Avg Elements/User" value={stats.avgElementsPerUser} icon="📊" accent="#059669" />
        <MetricCard title="Active (7 days)" value={stats.activeUsers7d} icon="⚡" accent="#ea580c" />
      </div>

      {/* ─── Two-column: Top Collected + Top Wanted ─── */}
      <div style={styles.twoCol}>
        {/* Top 10 Most Collected */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🏆 Top 10 Most Collected</h3>
          </div>
          {topCollected.length === 0 ? (
            <div style={styles.empty}>No collection data yet</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Element</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Count</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>% Users</th>
                </tr>
              </thead>
              <tbody>
                {topCollected.map((el, i) => (
                  <tr key={el.elementSymbol} style={i % 2 === 0 ? {} : styles.altRow}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}>
                      <span style={styles.symbol}>{el.elementSymbol}</span>{' '}
                      <span style={styles.elName}>{el.elementName}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{el.count}</td>
                    <td style={{ ...styles.td, textAlign: 'right' }}>
                      <span style={styles.pctBadge}>{el.percentage}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Top 10 Most Wanted */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🔥 Top 10 Most Wanted</h3>
          </div>
          {topWanted.length === 0 ? (
            <div style={styles.empty}>No wishlist data yet</div>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Element</th>
                  <th style={{ ...styles.th, textAlign: 'right' }}>Wishlist</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Stock</th>
                </tr>
              </thead>
              <tbody>
                {topWanted.map((el, i) => (
                  <tr key={el.elementSymbol} style={i % 2 === 0 ? {} : styles.altRow}>
                    <td style={styles.td}>{i + 1}</td>
                    <td style={styles.td}>
                      <span style={styles.symbol}>{el.elementSymbol}</span>{' '}
                      <span style={styles.elName}>{el.elementName}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'right', fontWeight: 600 }}>{el.wishlistCount}</td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={{
                        ...styles.stockBadge,
                        background: el.inStock ? '#e8f5e9' : '#fbe9e7',
                        color: el.inStock ? '#2e7d32' : '#c62828',
                      }}>
                        {el.inStock ? '✓ In Stock' : '✗ Out'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* ─── Recent Activity Feed ─── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>🕐 Recent Activity</h3>
        </div>
        {recentActivity.length === 0 ? (
          <div style={styles.empty}>No recent activity</div>
        ) : (
          <div style={styles.activityList}>
            {recentActivity.map(a => (
              <div key={a.id} style={styles.activityItem}>
                <div style={styles.activityDot} />
                <div style={styles.activityContent}>
                  <span style={styles.activityUser}>{a.userName}</span>
                  {' '}
                  <span style={styles.activityAction}>
                    {a.action === 'state_changed' && a.details?.to === 'OWNED'
                      ? 'acquired'
                      : a.action === 'state_changed' && a.details?.to === 'WANTED'
                      ? 'added to wishlist'
                      : a.action === 'state_changed'
                      ? `changed to ${a.details?.to || 'unknown'}`
                      : a.action}
                  </span>
                  {' '}
                  <span style={styles.symbol}>{a.elementSymbol}</span>
                  {' '}
                  <span style={styles.activityEl}>{a.elementName}</span>
                </div>
                <div style={styles.activityDate}>
                  {new Date(a.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  {' '}
                  {new Date(a.date).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  metricsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
    gap: 16,
    marginBottom: 28,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))',
    gap: 20,
    marginBottom: 28,
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid var(--luc-border, #e0e0e0)',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  cardHeader: {
    padding: '14px 18px 10px',
    borderBottom: '1px solid var(--luc-border, #e0e0e0)',
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
    margin: 0,
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
  },
  td: {
    padding: '10px 14px',
    color: 'var(--luc-text, #333)',
    borderBottom: '1px solid #f5f5f5',
  },
  altRow: {
    background: '#fafafa',
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
  pctBadge: {
    display: 'inline-block',
    background: '#e8f5e9',
    color: '#2e7d32',
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
  empty: {
    padding: 40,
    textAlign: 'center',
    color: 'var(--luc-text-muted, #888)',
    fontSize: 14,
  },
  activityList: {
    padding: '8px 0',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '10px 18px',
    borderBottom: '1px solid #f5f5f5',
  },
  activityDot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    background: '#2563eb',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
    fontSize: 13,
    color: 'var(--luc-text, #333)',
  },
  activityUser: {
    fontWeight: 600,
  },
  activityAction: {
    color: 'var(--luc-text-muted, #666)',
  },
  activityEl: {
    color: 'var(--luc-text-muted, #666)',
    fontSize: 12,
  },
  activityDate: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
    whiteSpace: 'nowrap',
  },
};
