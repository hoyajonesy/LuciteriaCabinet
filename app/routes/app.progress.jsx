/**
 * Collection Progress — Detailed progress tracking
 * 
 * Shows:
 * - Overall collection progress
 * - Progress by periodic table group (20 groups)
 * - Progress by format (5 formats)
 * - Active goals and goal management
 * - Full milestone list (earned + locked)
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import AppNav from "../components/AppNav";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import {
  getCollectionStats,
  getProgressByGroup,
  getProgressByFormat,
  getActiveGoals,
  setCollectionGoal,
} from "../lib/collection.server";
import { getUserMilestones } from "../lib/milestones.server";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");
  if (!authUser.onboardingCompleted) return redirect("/onboarding/welcome");

  const stats = await getCollectionStats(userId);
  const groupProgress = await getProgressByGroup(userId);
  const formatProgress = await getProgressByFormat(userId);
  const goals = await getActiveGoals(userId);
  const milestoneData = await getUserMilestones(userId);

  return json({
    stats,
    groupProgress,
    formatProgress,
    goals,
    milestones: milestoneData.milestones,
    totalMilestones: milestoneData.totalEarned,
    possibleMilestones: milestoneData.totalPossible,
    authUser: {
      firstName: authUser.firstName,
      userType: authUser.userType,
      isSubscriber: authUser.isSubscriber,
    },
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add-goal") {
    const goalType = formData.get("goalType");
    const title = formData.get("title");
    const targetFormat = formData.get("targetFormat") || null;
    const targetGroup = formData.get("targetGroup") || null;
    const targetCount = formData.get("targetCount") ? parseInt(formData.get("targetCount")) : null;

    await setCollectionGoal(userId, { goalType, title, targetFormat, targetGroup, targetCount });
    return json({ ok: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

export default function ProgressPage() {
  const {
    stats, groupProgress, formatProgress, goals,
    milestones, totalMilestones, possibleMilestones, authUser,
  } = useLoaderData();
  const fetcher = useFetcher();

  // Sort groups: completed first, then by percentage desc
  const sortedGroups = [...groupProgress].sort((a, b) => {
    if (a.percentage === 100 && b.percentage < 100) return -1;
    if (b.percentage === 100 && a.percentage < 100) return 1;
    return b.percentage - a.percentage;
  });

  return (
    <div style={styles.layout}>
      <AppNav currentPath="/app/progress" userType={authUser.userType} isSubscriber={authUser.isSubscriber} />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.title}>📊 Collection Progress</h1>
          <Link to="/app/cabinet" style={styles.backLink}>← Back to Collection</Link>
        </div>

        {/* Overall Progress */}
        <div style={styles.overallCard}>
          <div style={styles.overallLeft}>
            <div style={styles.bigNumber}>{stats.percentage}%</div>
            <div style={styles.bigLabel}>{stats.owned} of 118 elements</div>
          </div>
          <div style={styles.overallRight}>
            <div style={styles.miniStat}><span style={{ color: '#388E3C' }}>✓</span> {stats.owned} Owned</div>
            <div style={styles.miniStat}><span style={{ color: '#F9A825' }}>♡</span> {stats.wanted} Wanted</div>
            <div style={styles.miniStat}><span style={{ color: '#1976D2' }}>👁</span> {stats.watchlist} Watchlist</div>
            <div style={styles.miniStat}><span style={{ color: '#9e9e9e' }}>○</span> {stats.missing} Missing</div>
          </div>
          <div style={styles.progressBarLarge}>
            <div style={{ ...styles.progressFill, width: `${stats.percentage}%` }} />
          </div>
        </div>

        {/* Two columns: Groups + Formats */}
        <div style={styles.twoCol}>
          {/* Group Progress */}
          <div style={styles.card}>
            <h2 style={styles.cardTitle}>Periodic Table Groups</h2>
            <div style={styles.groupList}>
              {sortedGroups.map((group, i) => (
                <div key={i} style={styles.groupRow}>
                  <div style={styles.groupHeader}>
                    <span style={{
                      ...styles.groupDot,
                      background: group.groupInfo?.color || '#ccc',
                    }} />
                    <span style={styles.groupName}>
                      {group.groupInfo?.label || `Group ${group.groupKey}`}
                    </span>
                    <span style={styles.groupCount}>{group.owned}/{group.total}</span>
                    {group.percentage === 100 && <span style={styles.completeBadge}>✓</span>}
                  </div>
                  <div style={styles.progressBarSmall}>
                    <div style={{
                      ...styles.progressFillSmall,
                      width: `${group.percentage}%`,
                      background: group.percentage === 100 ? '#388E3C' : group.percentage >= 50 ? '#F9A825' : '#1976D2',
                    }} />
                  </div>
                  {group.missing.length > 0 && group.missing.length <= 5 && (
                    <div style={styles.missingHint}>
                      Missing: {group.missing.join(', ')}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Format Progress + Goals + Milestones */}
          <div>
            {/* Format Progress */}
            <div style={{ ...styles.card, marginBottom: 20 }}>
              <h2 style={styles.cardTitle}>Progress by Format</h2>
              {formatProgress.map((fmt, i) => (
                <div key={i} style={styles.formatRow}>
                  <div style={styles.formatHeader}>
                    <span style={styles.formatIcon}>{fmt.icon}</span>
                    <span style={styles.formatName}>{fmt.formatName}</span>
                    <span style={styles.formatCount}>{fmt.owned}/{fmt.total}</span>
                  </div>
                  <div style={styles.progressBarSmall}>
                    <div style={{
                      ...styles.progressFillSmall,
                      width: `${fmt.percentage}%`,
                      background: '#7B1FA2',
                    }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Active Goals */}
            <div style={{ ...styles.card, marginBottom: 20 }}>
              <h2 style={styles.cardTitle}>🎯 Active Goals</h2>
              {goals.length === 0 ? (
                <p style={styles.emptyText}>No active goals. Set a goal to track your progress!</p>
              ) : (
                goals.map((goal, i) => (
                  <div key={i} style={styles.goalRow}>
                    <span style={styles.goalTitle}>{goal.title}</span>
                    <span style={styles.goalType}>{goal.goalType.replace('_', ' ')}</span>
                  </div>
                ))
              )}
            </div>

            {/* Milestones */}
            <div style={styles.card}>
              <h2 style={styles.cardTitle}>
                🏆 Milestones ({totalMilestones}/{possibleMilestones})
              </h2>
              <div style={styles.milestoneGrid}>
                {milestones.map((m, i) => (
                  <div key={i} style={{
                    ...styles.milestoneItem,
                    opacity: m.isEarned ? 1 : 0.4,
                    background: m.isEarned ? '#f0fdf4' : '#fafafa',
                  }}>
                    <span style={styles.milestoneIcon}>{m.isEarned ? m.icon : '🔒'}</span>
                    <span style={styles.milestoneName}>{m.title}</span>
                    <span style={styles.milestoneDesc}>{m.description}</span>
                    {m.isEarned && m.earnedAt && (
                      <span style={styles.milestoneDate}>
                        {new Date(m.earnedAt).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#f8f9fa" },
  main: { flex: 1, marginLeft: 240, padding: "24px 32px", maxWidth: 1200 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 },
  backLink: { fontSize: 13, color: "#1976D2", textDecoration: "none" },
  overallCard: {
    background: "#fff", borderRadius: 16, padding: 28,
    border: "1px solid #e9ecef", marginBottom: 24,
    display: "flex", flexWrap: "wrap", gap: 24, alignItems: "center",
  },
  overallLeft: { textAlign: "center" },
  bigNumber: { fontSize: 56, fontWeight: 900, color: "#388E3C", lineHeight: 1 },
  bigLabel: { fontSize: 14, color: "#666", marginTop: 4 },
  overallRight: { display: "flex", gap: 20, flexWrap: "wrap" },
  miniStat: { fontSize: 14, fontWeight: 600, color: "#333" },
  progressBarLarge: {
    width: "100%", height: 12, background: "#f0f0f0",
    borderRadius: 6, overflow: "hidden",
  },
  progressFill: { height: "100%", background: "#388E3C", borderRadius: 6, transition: "width 0.3s" },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 },
  card: { background: "#fff", borderRadius: 12, padding: 20, border: "1px solid #e9ecef" },
  cardTitle: { fontSize: 16, fontWeight: 700, color: "#333", margin: "0 0 16px" },
  groupList: { display: "flex", flexDirection: "column", gap: 12 },
  groupRow: { marginBottom: 2 },
  groupHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  groupDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  groupName: { fontSize: 12, fontWeight: 600, color: "#333", flex: 1 },
  groupCount: { fontSize: 11, color: "#888" },
  completeBadge: {
    fontSize: 10, color: "#388E3C", background: "#e8f5e9",
    borderRadius: "50%", width: 18, height: 18,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700,
  },
  progressBarSmall: { height: 6, background: "#f0f0f0", borderRadius: 3, overflow: "hidden" },
  progressFillSmall: { height: "100%", borderRadius: 3, transition: "width 0.3s" },
  missingHint: { fontSize: 10, color: "#999", marginTop: 2, fontStyle: "italic" },
  formatRow: { marginBottom: 14 },
  formatHeader: { display: "flex", alignItems: "center", gap: 8, marginBottom: 4 },
  formatIcon: { fontSize: 16 },
  formatName: { fontSize: 13, fontWeight: 600, color: "#333", flex: 1 },
  formatCount: { fontSize: 11, color: "#888" },
  emptyText: { fontSize: 13, color: "#999", fontStyle: "italic" },
  goalRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #f0f0f0" },
  goalTitle: { fontSize: 13, fontWeight: 600, color: "#333" },
  goalType: { fontSize: 11, color: "#888", textTransform: "capitalize" },
  milestoneGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 },
  milestoneItem: {
    borderRadius: 10, padding: 12, border: "1px solid #e9ecef",
    textAlign: "center",
  },
  milestoneIcon: { fontSize: 24, display: "block", marginBottom: 4 },
  milestoneName: { fontSize: 12, fontWeight: 700, color: "#333", display: "block" },
  milestoneDesc: { fontSize: 10, color: "#888", display: "block", marginTop: 2 },
  milestoneDate: { fontSize: 9, color: "#aaa", display: "block", marginTop: 4 },
};
