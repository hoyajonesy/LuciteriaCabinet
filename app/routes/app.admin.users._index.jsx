/**
 * Admin User Collections List — /app/admin/users
 *
 * Table view of all users with collection stats, search, CSV export.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { getAllUsersWithCollectionStats, exportUsersCSV, requireAdmin } from "../lib/admin.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const users = await getAllUsersWithCollectionStats();
  return json({ users });
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "export") {
    const csv = await exportUsersCSV();
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="luciteria-users-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  }

  return json({ ok: true });
};

const ONBOARDING_FILTERS = [
  { value: "ALL", label: "All onboarding" },
  { value: "PENDING", label: "Pending" },
  { value: "BACKSTOP_ONLY", label: "Backstop only" },
  { value: "COMPLETE", label: "Complete" },
  { value: "NONE", label: "No subscription" },
];

// Sort weight so PENDING (needs attention) and BACKSTOP_ONLY float to the top.
const ONBOARDING_SORT_WEIGHT = { PENDING: 0, BACKSTOP_ONLY: 1, COMPLETE: 2 };

function onboardingBadgeStyle(status) {
  const base = {
    display: 'inline-block',
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    whiteSpace: 'nowrap',
  };
  if (status === 'COMPLETE') return { ...base, background: '#dcfce7', color: '#059669' };
  if (status === 'BACKSTOP_ONLY') return { ...base, background: '#fee2e2', color: '#dc2626' };
  if (status === 'PENDING') return { ...base, background: '#fef3c7', color: '#b45309' };
  return { ...base, background: '#f3f4f6', color: '#999' };
}

export default function AdminUsers() {
  const { users } = useLoaderData();
  const [search, setSearch] = useState("");
  const [onboardingFilter, setOnboardingFilter] = useState("ALL");
  const [sortByOnboarding, setSortByOnboarding] = useState(false);
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 25;

  let filtered = users.filter(u => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      if (!matches) return false;
    }
    if (onboardingFilter !== "ALL") {
      if (onboardingFilter === "NONE") {
        if (u.onboardingStatus) return false;
      } else if (u.onboardingStatus !== onboardingFilter) {
        return false;
      }
    }
    return true;
  });

  if (sortByOnboarding) {
    filtered = [...filtered].sort((a, b) => {
      const wa = a.onboardingStatus ? ONBOARDING_SORT_WEIGHT[a.onboardingStatus] ?? 3 : 4;
      const wb = b.onboardingStatus ? ONBOARDING_SORT_WEIGHT[b.onboardingStatus] ?? 3 : 4;
      return wa - wb;
    });
  }

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div>
      {/* ─── Toolbar ─── */}
      <div style={styles.toolbar}>
        <div style={styles.searchWrap}>
          <span style={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Search by name or email..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={styles.searchInput}
          />
          {search && (
            <button onClick={() => setSearch("")} style={styles.clearBtn}>✕</button>
          )}
        </div>
        <select
          value={onboardingFilter}
          onChange={e => { setOnboardingFilter(e.target.value); setPage(0); }}
          style={styles.filterSelect}
          aria-label="Filter by onboarding status"
        >
          {ONBOARDING_FILTERS.map(f => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>
        <div style={styles.toolbarRight}>
          <span style={styles.countLabel}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
          <form method="post" style={{ display: 'inline' }}>
            <input type="hidden" name="intent" value="export" />
            <button type="submit" style={styles.exportBtn}>📥 Export CSV</button>
          </form>
        </div>
      </div>

      {/* ─── Table ─── */}
      <div style={styles.card}>
        {paged.length === 0 ? (
          <div style={styles.empty}>
            {search ? `No users matching "${search}"` : "No users yet"}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Elements</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Completion</th>
                  <th
                    style={{ ...styles.th, textAlign: 'center', cursor: 'pointer', userSelect: 'none' }}
                    onClick={() => setSortByOnboarding(v => !v)}
                    title="Click to sort by onboarding status"
                  >
                    Onboarding {sortByOnboarding ? '▲' : '⇅'}
                  </th>
                  <th style={styles.th}>Last Activity</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paged.map((u, i) => (
                  <tr key={u.id} style={i % 2 === 0 ? {} : styles.altRow}>
                    <td style={styles.td}>
                      <div style={styles.userName}>
                        {u.firstName} {u.lastName}
                        {u.isStaff && <span style={styles.staffBadge}>Staff</span>}
                      </div>
                      <div style={styles.userType}>{u.userType}</div>
                    </td>
                    <td style={styles.td}>
                      <span style={styles.email}>{u.email}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <span style={styles.countBold}>{u.elementsOwned}</span>
                      <span style={styles.countTotal}>/118</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <div style={styles.progressWrap}>
                        <div style={styles.progressTrack}>
                          <div style={{ ...styles.progressFill, width: `${u.completionPercent}%` }} />
                        </div>
                        <span style={styles.pctLabel}>{u.completionPercent}%</span>
                      </div>
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      {u.onboardingStatus ? (
                        <span style={onboardingBadgeStyle(u.onboardingStatus)}>
                          {u.onboardingStatus === 'BACKSTOP_ONLY' ? 'BACKSTOP' : u.onboardingStatus}
                        </span>
                      ) : (
                        <span style={styles.noActivity}>—</span>
                      )}
                    </td>
                    <td style={styles.td}>
                      {u.lastActivity ? (
                        <span style={styles.dateText}>
                          {new Date(u.lastActivity).toLocaleDateString('en-US', {
                            month: 'short', day: 'numeric', year: 'numeric'
                          })}
                        </span>
                      ) : (
                        <span style={styles.noActivity}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <Link to={`/app/admin/users/${u.id}`} style={styles.viewBtn}>
                        View Collection
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ─── Pagination ─── */}
      {totalPages > 1 && (
        <div style={styles.pagination}>
          <button
            onClick={() => setPage(p => Math.max(0, p - 1))}
            disabled={page === 0}
            style={{ ...styles.pageBtn, opacity: page === 0 ? 0.4 : 1 }}
          >
            ← Prev
          </button>
          <span style={styles.pageInfo}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
            disabled={page >= totalPages - 1}
            style={{ ...styles.pageBtn, opacity: page >= totalPages - 1 ? 0.4 : 1 }}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
    gap: 16,
    flexWrap: 'wrap',
  },
  searchWrap: {
    display: 'flex',
    alignItems: 'center',
    background: '#fff',
    border: '1px solid var(--luc-border, #e0e0e0)',
    borderRadius: 8,
    padding: '0 12px',
    flex: '1 1 280px',
    maxWidth: 400,
  },
  searchIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    outline: 'none',
    padding: '9px 0',
    fontSize: 13,
    background: 'transparent',
  },
  clearBtn: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 14,
    color: '#999',
    padding: '2px 4px',
  },
  filterSelect: {
    padding: '8px 12px',
    borderRadius: 8,
    border: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fff',
    fontSize: 13,
    color: 'var(--luc-text, #1a1a1a)',
    cursor: 'pointer',
  },
  toolbarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  countLabel: {
    fontSize: 13,
    color: 'var(--luc-text-muted, #888)',
  },
  exportBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 6,
    border: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fff',
    color: 'var(--luc-text, #1a1a1a)',
    fontSize: 13,
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
    padding: '12px 14px',
    borderBottom: '1px solid #f5f5f5',
    verticalAlign: 'middle',
  },
  altRow: {
    background: '#fafafa',
  },
  userName: {
    fontWeight: 600,
    color: 'var(--luc-text, #1a1a1a)',
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  staffBadge: {
    display: 'inline-block',
    background: '#e8f5e9',
    color: '#2e7d32',
    fontSize: 10,
    fontWeight: 600,
    padding: '1px 6px',
    borderRadius: 8,
    textTransform: 'uppercase',
  },
  userType: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
    textTransform: 'capitalize',
  },
  email: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #666)',
  },
  countBold: {
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--luc-text, #1a1a1a)',
  },
  countTotal: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #999)',
  },
  progressWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  progressTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    background: '#eee',
    overflow: 'hidden',
    maxWidth: 80,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
    background: 'var(--luc-accent, #2563eb)',
    transition: 'width 0.3s',
  },
  pctLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--luc-text, #333)',
    minWidth: 32,
  },
  dateText: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #666)',
  },
  noActivity: {
    color: '#ccc',
  },
  viewBtn: {
    display: 'inline-block',
    padding: '5px 12px',
    borderRadius: 6,
    background: '#f0f4ff',
    color: '#2563eb',
    fontSize: 12,
    fontWeight: 600,
    textDecoration: 'none',
    transition: 'all 0.15s',
  },
  empty: {
    padding: 40,
    textAlign: 'center',
    color: 'var(--luc-text-muted, #888)',
    fontSize: 14,
  },
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    marginTop: 16,
    padding: '12px 0',
  },
  pageBtn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fff',
    fontSize: 13,
    cursor: 'pointer',
    fontWeight: 500,
  },
  pageInfo: {
    fontSize: 13,
    color: 'var(--luc-text-muted, #888)',
  },
};
