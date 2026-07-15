/**
 * Admin Dashboard Overview — /admin
 * Shows key platform metrics at a glance.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";

export const loader = async () => {
  const [
    totalUsers,
    activeUsers,
    frozenUsers,
    totalOwned,
    totalWanted,
    totalFormats,
    totalSets,
    recentUsers,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: "active" } }),
    prisma.user.count({ where: { status: "frozen" } }),
    prisma.collectionItem.count({ where: { state: "OWNED" } }),
    prisma.collectionItem.count({ where: { state: "WANTED" } }),
    prisma.format.count({ where: { isActive: true } }),
    prisma.collectionSet.count(),
    prisma.user.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, firstName: true, lastName: true, email: true, createdAt: true, status: true },
    }),
  ]);

  const avgCollection = totalUsers > 0
    ? Math.round(totalOwned / totalUsers)
    : 0;

  // Motivation breakdown
  const motivationGroups = await prisma.user.groupBy({
    by: ["primaryMotivation"],
    _count: true,
  });

  return json({
    totalUsers,
    activeUsers,
    frozenUsers,
    totalOwned,
    totalWanted,
    avgCollection,
    totalFormats,
    totalSets,
    recentUsers,
    motivationGroups,
  });
};

function MetricCard({ title, value, icon, accent = "#2563eb" }) {
  return (
    <div style={{ ...S.metricCard, borderTopColor: accent }}>
      <div style={S.metricIcon}>{icon}</div>
      <div style={S.metricValue}>{value}</div>
      <div style={S.metricTitle}>{title}</div>
    </div>
  );
}

export default function AdminDashboard() {
  const d = useLoaderData();

  return (
    <div>
      <div style={S.pageHeader}>
        <h1 style={S.h1}>Dashboard</h1>
        <span style={S.badge}>Admin</span>
      </div>
      <p style={S.subtitle}>Platform overview and quick stats.</p>

      {/* Metrics Grid */}
      <div style={S.metricsGrid}>
        <MetricCard title="Total Users" value={d.totalUsers} icon="👥" accent="#2563eb" />
        <MetricCard title="Active Users" value={d.activeUsers} icon="✅" accent="#059669" />
        <MetricCard title="Frozen Users" value={d.frozenUsers} icon="❄️" accent="#dc2626" />
        <MetricCard title="Elements Owned" value={d.totalOwned} icon="🧊" accent="#7c3aed" />
        <MetricCard title="Elements Wanted" value={d.totalWanted} icon="💫" accent="#ea580c" />
        <MetricCard title="Avg Collection" value={d.avgCollection} icon="📊" accent="#0891b2" />
        <MetricCard title="Active Formats" value={d.totalFormats} icon="📐" accent="#4f46e5" />
        <MetricCard title="Collection Sets" value={d.totalSets} icon="📦" accent="#b45309" />
      </div>

      {/* Quick Links */}
      <div style={S.quickLinksRow}>
        <Link to="/admin/users" style={S.quickLink}>👥 Manage Users →</Link>
        <Link to="/admin/analytics" style={S.quickLink}>📈 View Analytics →</Link>
        <Link to="/admin/notifications" style={S.quickLink}>🔔 Send Notification →</Link>
        <Link to="/admin/milestones" style={S.quickLink}>🏆 Award Milestone →</Link>
      </div>

      {/* Recent Users */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <h3 style={S.cardTitle}>🕐 Recent Signups</h3>
          <Link to="/admin/users" style={S.viewAll}>View all →</Link>
        </div>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Name</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Joined</th>
              <th style={S.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {d.recentUsers.map(u => (
              <tr key={u.id}>
                <td style={S.td}>{u.firstName} {u.lastName}</td>
                <td style={{ ...S.td, color: "#6b7280" }}>{u.email}</td>
                <td style={{ ...S.td, color: "#6b7280" }}>
                  {new Date(u.createdAt).toLocaleDateString()}
                </td>
                <td style={S.td}>
                  <span style={{
                    ...S.statusBadge,
                    background: u.status === "active" ? "#f0fdf4" : "#fef2f2",
                    color: u.status === "active" ? "#166534" : "#991b1b",
                    border: `1px solid ${u.status === "active" ? "#bbf7d0" : "#fecaca"}`,
                  }}>
                    {u.status === "active" ? "Active" : "Frozen"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const S = {
  pageHeader: { display: "flex", alignItems: "center", gap: 12, marginBottom: 4 },
  h1: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  badge: {
    padding: "2px 10px", borderRadius: 12, background: "#e8f5e9",
    color: "#2e7d32", fontSize: 11, fontWeight: 600, textTransform: "uppercase",
  },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 24, marginTop: 0 },
  metricsGrid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 16, marginBottom: 24,
  },
  metricCard: {
    background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
    borderTop: "3px solid #2563eb", padding: "16px 18px",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  metricIcon: { fontSize: 20, marginBottom: 4 },
  metricValue: { fontSize: 28, fontWeight: 700, color: "#111827" },
  metricTitle: { fontSize: 12, color: "#6b7280", marginTop: 2 },
  quickLinksRow: {
    display: "flex", gap: 12, marginBottom: 24, flexWrap: "wrap",
  },
  quickLink: {
    padding: "10px 18px", background: "#fff", border: "1px solid #e5e7eb",
    borderRadius: 6, fontSize: 13, color: "#374151", textDecoration: "none",
    fontWeight: 500, transition: "all 0.15s",
  },
  card: {
    background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
    overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", marginBottom: 24,
  },
  cardHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "14px 18px", borderBottom: "1px solid #e5e7eb",
  },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
  viewAll: { fontSize: 12, color: "#2563eb", textDecoration: "none" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "10px 18px", fontWeight: 600, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280",
    background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
  },
  td: { padding: "10px 18px", color: "#374151", borderBottom: "1px solid #f3f4f6" },
  statusBadge: {
    display: "inline-block", padding: "2px 10px", borderRadius: 12,
    fontSize: 11, fontWeight: 600,
  },
};
