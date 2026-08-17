/**
 * Admin User Collections List — /app/admin/users
 *
 * Table view of all users with collection stats, search, CSV export.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData, useNavigation, useSubmit } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  getAllUsersWithCollectionStats,
  exportUsersCSV,
  requireAdmin,
  freezeUser,
  unfreezeUser,
  deactivateUsers,
  restoreUsers,
  hardDeleteUsers,
} from "../lib/admin.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const users = await getAllUsersWithCollectionStats();
  return json({ users });
};

export const action = async ({ request }) => {
  const admin = await requireAdmin(request);
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

  // ─── Freeze (single) ───
  if (intent === "freeze") {
    const userId = formData.get("userId");
    if (!userId) return json({ error: "No user specified." }, { status: 400 });
    await freezeUser(userId, formData.get("reason"), admin.email);
    return json({ success: true, action: "frozen" });
  }

  // ─── Unfreeze (single) ───
  if (intent === "unfreeze") {
    const userId = formData.get("userId");
    if (!userId) return json({ error: "No user specified." }, { status: 400 });
    await unfreezeUser(userId, admin.email);
    return json({ success: true, action: "unfrozen" });
  }

  // ─── Deactivate / Restore / Hard-delete (single + bulk) ───
  if (intent === "deactivate" || intent === "restore" || intent === "hard-delete") {
    const userIds = formData.getAll("userIds").filter(Boolean);
    if (userIds.length === 0) return json({ error: "No users selected." }, { status: 400 });

    if (intent === "deactivate") {
      await deactivateUsers(userIds);
      return json({ success: true, action: `deactivated (${userIds.length})` });
    }
    if (intent === "restore") {
      await restoreUsers(userIds);
      return json({ success: true, action: `restored (${userIds.length})` });
    }
    if (intent === "hard-delete") {
      await hardDeleteUsers(userIds);
      return json({ success: true, action: `permanently deleted (${userIds.length})` });
    }
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
  const actionData = useActionData();
  const navigation = useNavigation();
  const submit = useSubmit();
  const [search, setSearch] = useState("");
  const [onboardingFilter, setOnboardingFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("ACTIVE_LIST");
  const [sortByOnboarding, setSortByOnboarding] = useState(false);
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState(() => new Set());
  const [freezeModal, setFreezeModal] = useState(null);
  const [deleteModal, setDeleteModal] = useState(null);
  const PAGE_SIZE = 25;

  const submitting = navigation.state === "submitting";

  // Clear transient UI after a successful action.
  useEffect(() => {
    if (actionData?.success) {
      setFreezeModal(null);
      setDeleteModal(null);
      setSelected(new Set());
    }
  }, [actionData]);

  // Clear selection when the visible list changes (filters/search/page).
  useEffect(() => {
    setSelected(new Set());
  }, [search, onboardingFilter, statusFilter]);

  let filtered = users.filter(u => {
    if (search) {
      const q = search.toLowerCase();
      const matches =
        u.firstName.toLowerCase().includes(q) ||
        u.lastName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q);
      if (!matches) return false;
    }
    // Account-status filter. "Active list" hides deactivated (soft-deleted).
    if (statusFilter === "ACTIVE_LIST") {
      if (u.status === "deleted") return false;
    } else if (statusFilter === "active") {
      if (u.status !== "active") return false;
    } else if (statusFilter === "frozen") {
      if (u.status !== "frozen") return false;
    } else if (statusFilter === "deleted") {
      if (u.status !== "deleted") return false;
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

  // ─── Selection helpers (operate on the current page) ───
  const toggleOne = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allVisibleSelected = paged.length > 0 && paged.every(u => selected.has(u.id));
  const toggleAll = () => {
    setSelected(prev => {
      if (paged.length > 0 && paged.every(u => prev.has(u.id))) return new Set();
      return new Set(paged.map(u => u.id));
    });
  };

  // Submit a status action (deactivate/restore/hard-delete) for one or many.
  const runStatusAction = (intent, userIds) => {
    const fd = new FormData();
    fd.set("intent", intent);
    userIds.forEach(id => fd.append("userIds", id));
    submit(fd, { method: "post" });
  };

  const openDeleteModal = (userList) => {
    setDeleteModal({
      users: userList.map(u => ({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() || u.email })),
    });
  };
  const confirmHardDelete = () => {
    if (!deleteModal) return;
    runStatusAction("hard-delete", deleteModal.users.map(u => u.id));
  };

  const selectedUsers = paged.filter(u => selected.has(u.id));

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
        <select
          value={statusFilter}
          onChange={e => { setStatusFilter(e.target.value); setPage(0); }}
          style={styles.filterSelect}
          aria-label="Filter by account status"
        >
          <option value="ACTIVE_LIST">Status: Active list</option>
          <option value="active">Active</option>
          <option value="frozen">Frozen</option>
          <option value="deleted">Deactivated</option>
        </select>
        <div style={styles.toolbarRight}>
          <span style={styles.countLabel}>{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
          <form method="post" style={{ display: 'inline' }}>
            <input type="hidden" name="intent" value="export" />
            <button type="submit" style={styles.exportBtn}>📥 Export CSV</button>
          </form>
        </div>
      </div>

      {/* ─── Action feedback ─── */}
      {actionData?.success && (
        <div style={styles.successToast}>✅ User {actionData.action} successfully.</div>
      )}
      {actionData?.error && (
        <div style={styles.errorToast}>⚠️ {actionData.error}</div>
      )}

      {/* ─── Bulk action bar ─── */}
      {selected.size > 0 && (
        <div style={styles.bulkBar}>
          <span style={styles.bulkCount}>{selected.size} selected</span>
          <div style={styles.bulkActions}>
            <button
              type="button"
              style={styles.bulkDeactivateBtn}
              disabled={submitting}
              onClick={() => runStatusAction("deactivate", [...selected])}
              title="Deactivate (soft delete — recoverable)"
            >
              🚫 Deactivate
            </button>
            <button
              type="button"
              style={styles.bulkRestoreBtn}
              disabled={submitting}
              onClick={() => runStatusAction("restore", [...selected])}
              title="Restore to active"
            >
              ♻️ Restore
            </button>
            <button
              type="button"
              style={styles.bulkDeleteBtn}
              disabled={submitting}
              onClick={() => openDeleteModal(selectedUsers)}
              title="Permanently delete — irreversible"
            >
              🗑 Delete permanently
            </button>
            <button type="button" style={styles.bulkClearBtn} onClick={() => setSelected(new Set())}>Clear</button>
          </div>
        </div>
      )}

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
                  <th style={{ ...styles.th, width: 36, textAlign: 'center' }}>
                    <input
                      type="checkbox"
                      checked={allVisibleSelected}
                      onChange={toggleAll}
                      style={styles.checkbox}
                      aria-label="Select all on this page"
                    />
                  </th>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Email</th>
                  <th style={{ ...styles.th, textAlign: 'center' }}>Status</th>
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
                  <tr key={u.id} style={selected.has(u.id) ? styles.selectedRow : (i % 2 === 0 ? {} : styles.altRow)}>
                    <td style={{ ...styles.td, textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(u.id)}
                        onChange={() => toggleOne(u.id)}
                        style={styles.checkbox}
                        aria-label={`Select ${u.email}`}
                      />
                    </td>
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
                      {u.status === 'frozen' ? (
                        <span style={{ ...styles.statusBadge, background: '#e0f2fe', color: '#0369a1' }} title={u.freezeReason || 'Frozen'}>❄️ Frozen</span>
                      ) : u.status === 'deleted' ? (
                        <span style={{ ...styles.statusBadge, background: '#fee2e2', color: '#dc2626' }}>🚫 Deactivated</span>
                      ) : (
                        <span style={{ ...styles.statusBadge, background: '#dcfce7', color: '#059669' }}>● Active</span>
                      )}
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
                    <td style={styles.td}>
                      <div style={styles.actionGroup}>
                        <Link to={`/app/admin/users/${u.id}`} style={styles.viewBtn}>
                          View
                        </Link>
                        {u.status === 'frozen' ? (
                          <Form method="post" style={{ display: 'inline' }}>
                            <input type="hidden" name="intent" value="unfreeze" />
                            <input type="hidden" name="userId" value={u.id} />
                            <button type="submit" style={styles.unfreezeBtn} disabled={submitting} title="Unfreeze account">Unfreeze</button>
                          </Form>
                        ) : u.status !== 'deleted' ? (
                          <button
                            type="button"
                            style={styles.freezeBtn}
                            disabled={submitting}
                            onClick={() => setFreezeModal({ id: u.id, name: `${u.firstName} ${u.lastName}`.trim() || u.email })}
                            title="Freeze account"
                          >
                            Freeze
                          </button>
                        ) : null}
                        {u.status === 'deleted' ? (
                          <button
                            type="button"
                            style={styles.restoreBtn}
                            disabled={submitting}
                            onClick={() => runStatusAction("restore", [u.id])}
                            title="Restore to active"
                          >
                            Restore
                          </button>
                        ) : (
                          <button
                            type="button"
                            style={styles.deactivateBtn}
                            disabled={submitting}
                            onClick={() => runStatusAction("deactivate", [u.id])}
                            title="Deactivate (soft delete — recoverable)"
                          >
                            Deactivate
                          </button>
                        )}
                        <button
                          type="button"
                          style={styles.deleteBtn}
                          disabled={submitting}
                          onClick={() => openDeleteModal([u])}
                          title="Permanently delete — irreversible"
                        >
                          🗑
                        </button>
                      </div>
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

      {/* ─── Freeze modal ─── */}
      {freezeModal && (
        <div style={styles.overlay} onClick={() => setFreezeModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>❄️ Freeze account</span>
              <button type="button" style={styles.modalClose} onClick={() => setFreezeModal(null)}>✕</button>
            </div>
            <Form method="post">
              <div style={styles.modalBody}>
                <div style={styles.modalUserInfo}>{freezeModal.name}</div>
                <p style={styles.warningBox}>
                  A frozen account is temporarily suspended. The member keeps their data
                  and can be unfrozen at any time.
                </p>
                <label style={styles.label}>Reason (shown in the audit log)</label>
                <textarea
                  name="reason"
                  required
                  rows={3}
                  style={styles.textarea}
                  placeholder="e.g. Payment dispute pending review"
                />
                <input type="hidden" name="intent" value="freeze" />
                <input type="hidden" name="userId" value={freezeModal.id} />
              </div>
              <div style={styles.modalActions}>
                <button type="button" style={styles.cancelBtn} onClick={() => setFreezeModal(null)}>Cancel</button>
                <button type="submit" style={styles.confirmFreezeBtn} disabled={submitting}>
                  {submitting ? 'Freezing…' : 'Freeze account'}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* ─── Permanent-delete confirmation modal ─── */}
      {deleteModal && (
        <div style={styles.overlay} onClick={() => setDeleteModal(null)}>
          <div style={styles.modal} onClick={e => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <span style={styles.modalTitle}>🗑 Permanently delete</span>
              <button type="button" style={styles.modalClose} onClick={() => setDeleteModal(null)}>✕</button>
            </div>
            <div style={styles.modalBody}>
              <p style={styles.dangerBox}>
                <strong>This cannot be undone.</strong> The following {deleteModal.users.length === 1 ? 'account' : `${deleteModal.users.length} accounts`} and all
                associated collection data, notifications, and logs will be permanently erased.
                To temporarily suspend instead, use <em>Deactivate</em>.
              </p>
              <ul style={styles.deleteList}>
                {deleteModal.users.map(u => (
                  <li key={u.id} style={styles.deleteListItem}>{u.name}</li>
                ))}
              </ul>
            </div>
            <div style={styles.modalActions}>
              <button type="button" style={styles.cancelBtn} onClick={() => setDeleteModal(null)}>Cancel</button>
              <button type="button" style={styles.confirmDeleteBtn} disabled={submitting} onClick={confirmHardDelete}>
                {submitting ? 'Deleting…' : `Delete permanently`}
              </button>
            </div>
          </div>
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

  // ─── Action feedback ───
  successToast: {
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 12,
    background: '#dcfce7',
    color: '#059669',
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid #bbf7d0',
  },
  errorToast: {
    padding: '10px 14px',
    borderRadius: 8,
    marginBottom: 12,
    background: '#fee2e2',
    color: '#dc2626',
    fontSize: 13,
    fontWeight: 600,
    border: '1px solid #fecaca',
  },

  // ─── Bulk action bar ───
  bulkBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '10px 16px',
    marginBottom: 12,
    background: '#f0f4ff',
    border: '1px solid #c7d7fe',
    borderRadius: 8,
  },
  bulkCount: {
    fontSize: 13,
    fontWeight: 700,
    color: '#2563eb',
  },
  bulkActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  bulkDeactivateBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #fca5a5',
    background: '#fff',
    color: '#dc2626',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkRestoreBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #86efac',
    background: '#fff',
    color: '#059669',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkDeleteBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid #dc2626',
    background: '#dc2626',
    color: '#fff',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  bulkClearBtn: {
    padding: '6px 12px',
    borderRadius: 6,
    border: 'none',
    background: 'transparent',
    color: 'var(--luc-text-muted, #888)',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },

  // ─── Selection / status ───
  checkbox: {
    width: 15,
    height: 15,
    cursor: 'pointer',
    accentColor: '#2563eb',
  },
  selectedRow: {
    background: '#f0f4ff',
  },
  statusBadge: {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 8,
    whiteSpace: 'nowrap',
  },

  // ─── Per-row action buttons ───
  actionGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  freezeBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #bae6fd',
    background: '#f0f9ff',
    color: '#0369a1',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  unfreezeBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #bae6fd',
    background: '#e0f2fe',
    color: '#0369a1',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deactivateBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #fed7aa',
    background: '#fff7ed',
    color: '#c2410c',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  restoreBtn: {
    padding: '5px 10px',
    borderRadius: 6,
    border: '1px solid #86efac',
    background: '#f0fdf4',
    color: '#059669',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  deleteBtn: {
    padding: '5px 9px',
    borderRadius: 6,
    border: '1px solid #fecaca',
    background: '#fff',
    color: '#dc2626',
    fontSize: 13,
    cursor: 'pointer',
  },

  // ─── Modals ───
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(0,0,0,0.4)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    padding: 20,
  },
  modal: {
    background: '#fff',
    borderRadius: 12,
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 12px 40px rgba(0,0,0,0.2)',
    overflow: 'hidden',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '14px 18px',
    borderBottom: '1px solid var(--luc-border, #e0e0e0)',
  },
  modalTitle: {
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
  },
  modalClose: {
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 16,
    color: '#999',
    padding: 2,
  },
  modalBody: {
    padding: '18px',
  },
  modalUserInfo: {
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
    marginBottom: 12,
  },
  warningBox: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: 'var(--luc-text-muted, #666)',
    background: '#f0f9ff',
    border: '1px solid #bae6fd',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 14,
  },
  dangerBox: {
    fontSize: 12.5,
    lineHeight: 1.5,
    color: '#991b1b',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: 8,
    padding: '10px 12px',
    marginBottom: 12,
  },
  deleteList: {
    listStyle: 'none',
    margin: 0,
    padding: 0,
    maxHeight: 160,
    overflowY: 'auto',
    border: '1px solid var(--luc-border, #e0e0e0)',
    borderRadius: 8,
  },
  deleteListItem: {
    padding: '8px 12px',
    fontSize: 13,
    borderBottom: '1px solid #f5f5f5',
    color: 'var(--luc-text, #1a1a1a)',
  },
  label: {
    display: 'block',
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--luc-text, #333)',
    marginBottom: 6,
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '9px 12px',
    borderRadius: 8,
    border: '1px solid var(--luc-border, #e0e0e0)',
    fontSize: 13,
    fontFamily: 'inherit',
    resize: 'vertical',
  },
  modalActions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 10,
    padding: '14px 18px',
    borderTop: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fafafa',
  },
  cancelBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fff',
    color: 'var(--luc-text, #1a1a1a)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmFreezeBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#0369a1',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
  confirmDeleteBtn: {
    padding: '8px 16px',
    borderRadius: 6,
    border: 'none',
    background: '#dc2626',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
