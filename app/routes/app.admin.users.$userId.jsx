/**
 * Admin User Collection Detail — /app/admin/users/:userId
 *
 * Shows a specific user's collection, milestones, goals, and activity.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { getUserCollectionDetail } from "../lib/admin.server.js";
import { ELEMENTS_118 } from "../data/elements.server.js";
import PeriodicTable from "../components/PeriodicTable.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import MetricCard from "../components/admin/MetricCard.jsx";

export const loader = async ({ params }) => {
  const detail = await getUserCollectionDetail(params.userId);
  if (!detail) throw redirect("/app/admin/users");

  // Serialize elements for the periodic table
  const elements = ELEMENTS_118.map(el => ({
    ...el,
    symbol: el.sym,
    atomicNumber: el.z,
  }));

  return json({
    ...detail,
    elements,
  });
};

export default function AdminUserDetail() {
  const { user, stats, collectionStates, items, milestones, goals, recentActivity, elements } = useLoaderData();

  return (
    <div>
      {/* ─── Breadcrumb ─── */}
      <div style={styles.breadcrumb}>
        <Link to="/app/admin/users" style={styles.breadcrumbLink}>← Back to Users</Link>
      </div>

      {/* ─── User Info ─── */}
      <div style={styles.userCard}>
        <div style={styles.userInfo}>
          <div style={styles.avatar}>
            {user.firstName[0]}{user.lastName[0]}
          </div>
          <div>
            <h2 style={styles.userName}>{user.firstName} {user.lastName}</h2>
            <div style={styles.userEmail}>{user.email}</div>
            <div style={styles.userMeta}>
              <span style={styles.typeBadge}>{user.userType}</span>
              {user.subscriptionFormat && (
                <span style={styles.formatBadge}>{user.subscriptionFormat}</span>
              )}
              <span style={styles.joinDate}>
                Joined {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Stats ─── */}
      <div style={styles.statsGrid}>
        <MetricCard title="Owned" value={stats.owned} icon="✅" accent="#059669" />
        <MetricCard title="Wanted" value={stats.wanted} icon="💛" accent="#eab308" />
        <MetricCard title="Watchlist" value={stats.watchlist} icon="👁️" accent="#7c3aed" />
        <MetricCard title="Completion" value={`${stats.completionPercent}%`} icon="🏆" accent="#2563eb" />
      </div>

      {/* ─── Progress Bar ─── */}
      <div style={styles.card}>
        <div style={styles.cardBody}>
          <ProgressBar value={stats.owned} max={118} label="Overall Completion" />
        </div>
      </div>

      {/* ─── Periodic Table ─── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>📊 Collection Map</h3>
        </div>
        <div style={styles.cardBody}>
          <PeriodicTable
            elements={elements}
            collectionStates={collectionStates}
            compact={true}
            readOnly={true}
            showFilters={false}
          />
        </div>
      </div>

      {/* ─── Two-column: Milestones + Goals ─── */}
      <div style={styles.twoCol}>
        {/* Milestones */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🏆 Milestones ({milestones.length})</h3>
          </div>
          {milestones.length === 0 ? (
            <div style={styles.empty}>No milestones earned yet</div>
          ) : (
            <div style={styles.listBody}>
              {milestones.map(m => (
                <div key={m.id} style={styles.listItem}>
                  <span style={styles.milestoneIcon}>{m.icon}</span>
                  <div>
                    <div style={styles.milestoneTitle}>{m.title}</div>
                    <div style={styles.milestoneDesc}>{m.description}</div>
                    <div style={styles.milestoneDate}>
                      {new Date(m.earnedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Goals */}
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🎯 Active Goals ({goals.length})</h3>
          </div>
          {goals.length === 0 ? (
            <div style={styles.empty}>No active goals</div>
          ) : (
            <div style={styles.listBody}>
              {goals.map(g => (
                <div key={g.id} style={styles.listItem}>
                  <span style={styles.milestoneIcon}>🎯</span>
                  <div>
                    <div style={styles.milestoneTitle}>{g.title}</div>
                    <div style={styles.milestoneDesc}>
                      Type: {g.goalType}
                      {g.targetFormat && ` · Format: ${g.targetFormat}`}
                      {g.targetGroup && ` · Group: ${g.targetGroup}`}
                      {g.targetCount && ` · Target: ${g.targetCount}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ─── Recent Activity ─── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>🕐 Recent Activity</h3>
        </div>
        {recentActivity.length === 0 ? (
          <div style={styles.empty}>No activity recorded</div>
        ) : (
          <div style={styles.listBody}>
            {recentActivity.slice(0, 15).map(a => {
              let details = {};
              try { details = JSON.parse(a.details || '{}'); } catch { /* ignore */ }
              return (
                <div key={a.id} style={styles.activityItem}>
                  <div style={styles.activityDot} />
                  <div style={styles.activityContent}>
                    <span style={{ fontWeight: 600 }}>{a.action}</span>
                    {a.elementSymbol && (
                      <>
                        {' '}<span style={styles.symbol}>{a.elementSymbol}</span>
                      </>
                    )}
                    {details.from && details.to && (
                      <span style={styles.stateChange}> {details.from} → {details.to}</span>
                    )}
                  </div>
                  <div style={styles.activityDate}>
                    {new Date(a.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  breadcrumb: {
    marginBottom: 16,
  },
  breadcrumbLink: {
    color: 'var(--luc-accent, #2563eb)',
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: 500,
  },
  userCard: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid var(--luc-border, #e0e0e0)',
    padding: '20px 24px',
    marginBottom: 20,
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: '50%',
    background: '#e8eaf6',
    color: '#3f51b5',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: 16,
    flexShrink: 0,
  },
  userName: {
    fontSize: 18,
    fontWeight: 700,
    margin: '0 0 2px',
    color: 'var(--luc-text, #1a1a1a)',
  },
  userEmail: {
    fontSize: 13,
    color: 'var(--luc-text-muted, #666)',
    marginBottom: 4,
  },
  userMeta: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  typeBadge: {
    display: 'inline-block',
    background: '#f0f4ff',
    color: '#2563eb',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 8,
    textTransform: 'capitalize',
  },
  formatBadge: {
    display: 'inline-block',
    background: '#faf5ff',
    color: '#7c3aed',
    fontSize: 11,
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: 8,
  },
  joinDate: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: 14,
    marginBottom: 20,
  },
  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid var(--luc-border, #e0e0e0)',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    marginBottom: 20,
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
  cardBody: {
    padding: 18,
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
    gap: 20,
    marginBottom: 20,
  },
  empty: {
    padding: 32,
    textAlign: 'center',
    color: 'var(--luc-text-muted, #888)',
    fontSize: 13,
  },
  listBody: {
    padding: '8px 0',
  },
  listItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 12,
    padding: '10px 18px',
    borderBottom: '1px solid #f5f5f5',
  },
  milestoneIcon: {
    fontSize: 20,
    flexShrink: 0,
    marginTop: 2,
  },
  milestoneTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: 'var(--luc-text, #1a1a1a)',
  },
  milestoneDesc: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #666)',
    marginTop: 2,
  },
  milestoneDate: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
    marginTop: 2,
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '8px 18px',
    borderBottom: '1px solid #f5f5f5',
  },
  activityDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: '#2563eb',
    flexShrink: 0,
  },
  activityContent: {
    flex: 1,
    fontSize: 13,
    color: 'var(--luc-text, #333)',
  },
  symbol: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f0f4ff',
    color: '#2563eb',
    fontWeight: 700,
    fontSize: 11,
    borderRadius: 4,
    padding: '1px 5px',
  },
  stateChange: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #888)',
  },
  activityDate: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
    whiteSpace: 'nowrap',
  },
};
