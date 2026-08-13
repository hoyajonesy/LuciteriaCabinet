/**
 * Admin User Collection Detail — /app/admin/users/:userId
 *
 * Shows a specific user's collection, milestones, goals, and activity.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link, Form, useActionData } from "@remix-run/react";
import { getUserCollectionDetail, requireAdmin } from "../lib/admin.server.js";
import { prisma } from "../lib/db.server.js";
import { unpublishPassport } from "../lib/passport.server.js";
import { markOnboardingCompleteByAdmin } from "../lib/subscription-onboarding.server.js";
import { ELEMENTS_118 } from "../data/elements.server.js";
import PeriodicTable from "../components/PeriodicTable.jsx";
import ProgressBar from "../components/ProgressBar.jsx";
import MetricCard from "../components/admin/MetricCard.jsx";

const PUBLIC_BASE = "https://cabinet.luciteria.com/p/";

/** Human-readable grace-window remaining time. */
function formatGrace(seconds) {
  if (seconds == null) return "";
  if (seconds <= 0) return "expired";
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  if (days > 0) return `${days}d ${hours}h left`;
  const mins = Math.floor((seconds % 3600) / 60);
  if (hours > 0) return `${hours}h ${mins}m left`;
  return `${mins}m left`;
}

/** Status badge coloring for onboarding status. */
function onboardingBadgeStyle(status) {
  const base = {
    display: 'inline-block',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 10px',
    borderRadius: 8,
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
  };
  if (status === 'COMPLETE') return { ...base, background: '#dcfce7', color: '#059669' };
  if (status === 'BACKSTOP_ONLY') return { ...base, background: '#fee2e2', color: '#dc2626' };
  return { ...base, background: '#fef3c7', color: '#b45309' }; // PENDING
}

export const loader = async ({ params }) => {
  const detail = await getUserCollectionDetail(params.userId);
  if (!detail) throw redirect("/app/admin/users");

  // Serialize elements for the periodic table
  const elements = ELEMENTS_118.map(el => ({
    ...el,
    symbol: el.sym,
    atomicNumber: el.z,
  }));

  // Collection Passport summary for staff oversight.
  const dbUser = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { handle: true, passport: { select: { published: true, publishedAt: true } } },
  });
  const passport = {
    exists: Boolean(dbUser?.passport),
    published: Boolean(dbUser?.passport?.published),
    publishedAt: dbUser?.passport?.publishedAt || null,
    handle: dbUser?.handle || null,
    publicUrl: dbUser?.handle ? `${PUBLIC_BASE}${dbUser.handle}` : null,
  };

  return json({
    ...detail,
    elements,
    passport,
  });
};

export const action = async ({ request, params }) => {
  // Staff-only guard (this route is also wrapped by the admin layout).
  const admin = await requireAdmin(request);

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "unpublish-passport") {
    await unpublishPassport(params.userId);
    return json({ ok: true, message: "Passport unpublished." });
  }

  if (intent === "mark-onboarding-complete") {
    const onboardingId = form.get("onboardingId");
    if (!onboardingId) {
      return json({ error: "Missing onboarding id." }, { status: 400 });
    }
    try {
      const staffName =
        admin.name ||
        [admin.firstName, admin.lastName].filter(Boolean).join(" ").trim() ||
        admin.email;
      await markOnboardingCompleteByAdmin({
        onboardingId: String(onboardingId),
        staff: { id: admin.id, email: admin.email, name: staffName },
      });
      return json({ ok: true, message: "Onboarding marked complete." });
    } catch (e) {
      return json({ error: e.message || "Failed to mark complete." }, { status: 400 });
    }
  }

  return json({ error: "Unknown action." }, { status: 400 });
};

export default function AdminUserDetail() {
  const { user, stats, collectionStates, items, milestones, goals, recentActivity, elements, passport, subscriptionOnboardings } = useLoaderData();
  const actionData = useActionData();

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

      {/* ─── Collection Passport ─── */}
      <div style={styles.card}>
        <div style={styles.cardHeader}>
          <h3 style={styles.cardTitle}>🪪 Collection Passport</h3>
        </div>
        <div style={styles.cardBody}>
          {actionData?.message && (
            <div style={styles.noticeOk}>{actionData.message}</div>
          )}
          {actionData?.error && (
            <div style={styles.noticeErr}>{actionData.error}</div>
          )}
          {!passport.exists ? (
            <div style={{ fontSize: 13, color: 'var(--luc-text-muted, #666)' }}>
              This collector hasn't set up a Passport yet.
            </div>
          ) : (
            <div style={styles.passportRow}>
              <div style={{ flex: 1 }}>
                <div style={{ marginBottom: 6 }}>
                  <span style={passport.published ? styles.pubBadge : styles.draftBadge}>
                    {passport.published ? "Published" : "Draft"}
                  </span>
                  {passport.publishedAt && (
                    <span style={{ fontSize: 12, color: 'var(--luc-text-muted, #999)', marginLeft: 8 }}>
                      since {new Date(passport.publishedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  )}
                </div>
                {passport.handle ? (
                  <div style={{ fontSize: 13 }}>
                    <span style={{ color: 'var(--luc-text-muted, #666)' }}>Public URL: </span>
                    {passport.published ? (
                      <a href={passport.publicUrl} target="_blank" rel="noreferrer" style={styles.breadcrumbLink}>
                        {passport.publicUrl}
                      </a>
                    ) : (
                      <span style={{ color: 'var(--luc-text-muted, #999)' }}>{passport.publicUrl}</span>
                    )}
                  </div>
                ) : (
                  <div style={{ fontSize: 13, color: 'var(--luc-text-muted, #999)' }}>No handle set.</div>
                )}
              </div>
              {passport.published && (
                <Form method="post" onSubmit={(e) => {
                  if (!confirm("Unpublish this collector's Passport? Their public page will go offline immediately.")) e.preventDefault();
                }}>
                  <input type="hidden" name="intent" value="unpublish-passport" />
                  <button type="submit" style={styles.unpublishBtn}>Unpublish Passport</button>
                </Form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ─── Subscription Onboarding (FR-26) ─── */}
      {subscriptionOnboardings && subscriptionOnboardings.length > 0 && (
        <div style={styles.card}>
          <div style={styles.cardHeader}>
            <h3 style={styles.cardTitle}>🧪 Subscription Onboarding</h3>
          </div>
          <div style={styles.cardBody}>
            {subscriptionOnboardings.map(ob => (
              <div key={ob.id} style={styles.onboardingBlock}>
                <div style={styles.onboardingTop}>
                  <span style={onboardingBadgeStyle(ob.status)}>{ob.status}</span>
                  <span style={styles.contractId}>Contract {ob.subscriptionContractId}</span>
                  <span style={styles.formatBadge}>{ob.formatTrack}</span>
                </div>

                <div style={styles.onboardingMeta}>
                  <div style={styles.metaCell}>
                    <div style={styles.metaLabel}>Seeded from order history</div>
                    <div style={styles.metaValue}>{ob.seededFromOrderHistory ? "Yes" : "No"}</div>
                  </div>
                  <div style={styles.metaCell}>
                    <div style={styles.metaLabel}>Reminders sent</div>
                    <div style={styles.metaValue}>{ob.remindersSent} / 2</div>
                  </div>
                  <div style={styles.metaCell}>
                    <div style={styles.metaLabel}>Grace expires</div>
                    <div style={styles.metaValue}>
                      {ob.graceExpiresAt
                        ? new Date(ob.graceExpiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
                        : "—"}
                      {ob.status === 'PENDING' && ob.graceRemainingSeconds != null && (
                        <span style={styles.graceRemaining}> · {formatGrace(ob.graceRemainingSeconds)}</span>
                      )}
                    </div>
                  </div>
                  <div style={styles.metaCell}>
                    <div style={styles.metaLabel}>Completed</div>
                    <div style={styles.metaValue}>
                      {ob.completedAt
                        ? new Date(ob.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                        : "—"}
                    </div>
                  </div>
                </div>

                {/* Ownership-record provenance from this onboarding (FR-3/4) */}
                <div style={styles.provenanceWrap}>
                  <div style={styles.metaLabel}>Ownership records from this onboarding</div>
                  {ob.provenanceItems.length === 0 ? (
                    <div style={styles.provenanceEmpty}>No confirmed or rejected records yet.</div>
                  ) : (
                    <div style={styles.provenanceList}>
                      {ob.provenanceItems.map(p => (
                        <div key={`${ob.id}-${p.elementSymbol}`} style={styles.provenanceRow}>
                          <span style={styles.symbol}>{p.elementSymbol}</span>
                          <span style={styles.provenanceName}>{p.elementName}{p.format ? ` · ${p.format}` : ''}</span>
                          <span style={p.rejectedBySubscriber ? styles.rejectedTag : (p.subscriberConfirmed ? styles.confirmedTag : styles.sourceTag)}>
                            {p.rejectedBySubscriber ? 'Rejected' : (p.subscriberConfirmed ? 'Confirmed owned' : p.ownershipSource)}
                          </span>
                          {p.recordedAt && (
                            <span style={styles.provenanceDate}>
                              {new Date(p.recordedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Manual completion (FR-28) */}
                {ob.status !== 'COMPLETE' && (
                  <Form method="post" onSubmit={(e) => {
                    if (!confirm("Mark this subscriber's onboarding as complete? This trusts their current owned-items state for assignment.")) e.preventDefault();
                  }}>
                    <input type="hidden" name="intent" value="mark-onboarding-complete" />
                    <input type="hidden" name="onboardingId" value={ob.id} />
                    <button type="submit" style={styles.markCompleteBtn}>Mark Onboarding Complete</button>
                  </Form>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
  passportRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  pubBadge: {
    display: 'inline-block',
    background: '#dcfce7',
    color: '#059669',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 8,
  },
  draftBadge: {
    display: 'inline-block',
    background: '#fef3c7',
    color: '#b45309',
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 8,
  },
  unpublishBtn: {
    background: '#fff',
    color: '#dc2626',
    border: '1px solid #fca5a5',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  noticeOk: {
    background: '#dcfce7',
    color: '#059669',
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 8,
    marginBottom: 12,
  },
  noticeErr: {
    background: '#fee2e2',
    color: '#dc2626',
    fontSize: 13,
    padding: '8px 12px',
    borderRadius: 8,
    marginBottom: 12,
  },
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
  onboardingBlock: {
    border: '1px solid var(--luc-border, #e0e0e0)',
    borderRadius: 8,
    padding: 16,
    marginBottom: 14,
  },
  onboardingTop: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    flexWrap: 'wrap',
    marginBottom: 14,
  },
  contractId: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #666)',
    fontFamily: 'monospace',
  },
  onboardingMeta: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
    gap: 12,
    marginBottom: 14,
  },
  metaCell: {},
  metaLabel: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
    textTransform: 'uppercase',
    letterSpacing: '0.03em',
    marginBottom: 3,
  },
  metaValue: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--luc-text, #1a1a1a)',
  },
  graceRemaining: {
    fontWeight: 500,
    color: 'var(--luc-text-muted, #888)',
  },
  provenanceWrap: {
    marginBottom: 14,
  },
  provenanceEmpty: {
    fontSize: 12,
    color: 'var(--luc-text-muted, #999)',
    marginTop: 4,
  },
  provenanceList: {
    marginTop: 6,
    border: '1px solid #f0f0f0',
    borderRadius: 6,
  },
  provenanceRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '6px 10px',
    borderBottom: '1px solid #f5f5f5',
    fontSize: 12,
  },
  provenanceName: {
    flex: 1,
    color: 'var(--luc-text, #333)',
  },
  provenanceDate: {
    fontSize: 11,
    color: 'var(--luc-text-muted, #999)',
    whiteSpace: 'nowrap',
  },
  confirmedTag: {
    fontSize: 10,
    fontWeight: 700,
    color: '#059669',
    background: '#dcfce7',
    padding: '1px 7px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  },
  rejectedTag: {
    fontSize: 10,
    fontWeight: 700,
    color: '#dc2626',
    background: '#fee2e2',
    padding: '1px 7px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  },
  sourceTag: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--luc-text-muted, #666)',
    background: '#f3f4f6',
    padding: '1px 7px',
    borderRadius: 6,
    whiteSpace: 'nowrap',
  },
  markCompleteBtn: {
    background: 'var(--luc-accent, #2563eb)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 14px',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
  },
};
