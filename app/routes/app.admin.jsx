/**
 * Admin Layout — wraps all /app/admin/* routes.
 * Provides sidebar nav, tab navigation, and isStaff check.
 */
import { json, redirect } from "@remix-run/node";
import { Outlet, useLoaderData, Link, useLocation } from "@remix-run/react";
import { getUserId } from "../lib/session.server.js";
import { prisma } from "../lib/db.server.js";
import AppNav from "../components/AppNav.jsx";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) throw redirect("/onboarding/welcome");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, firstName: true, lastName: true, isStaff: true },
  });

  if (!user) throw redirect("/onboarding/welcome");
  if (!user.isStaff) throw redirect("/app/cabinet");

  return json({ user });
};

const ADMIN_TABS = [
  { label: "Overview", path: "/app/admin", icon: "📊" },
  { label: "Users", path: "/app/admin/users", icon: "👥" },
  { label: "Demand", path: "/app/admin/demand", icon: "🔥" },
  { label: "Analytics", path: "/app/admin/analytics", icon: "📈" },
];

export default function AdminLayout() {
  const { user } = useLoaderData();
  const location = useLocation();

  const isTabActive = (tabPath) => {
    if (tabPath === "/app/admin") {
      return location.pathname === "/app/admin" || location.pathname === "/app/admin/";
    }
    return location.pathname.startsWith(tabPath);
  };

  return (
    <div style={styles.layout}>
      <AppNav mode="admin" customerName={`${user.firstName} ${user.lastName}`} />
      <main style={styles.main}>
        <div style={styles.header}>
          <h1 style={styles.h1}>Admin Dashboard</h1>
          <span style={styles.badge}>Staff</span>
        </div>
        <nav style={styles.tabs}>
          {ADMIN_TABS.map(tab => (
            <Link
              key={tab.path}
              to={tab.path}
              style={{
                ...styles.tab,
                ...(isTabActive(tab.path) ? styles.tabActive : {}),
              }}
            >
              <span>{tab.icon}</span> {tab.label}
            </Link>
          ))}
        </nav>
        <div style={styles.content}>
          <Outlet />
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: 'flex',
    minHeight: '100vh',
    background: 'var(--luc-bg, #f5f5f5)',
  },
  main: {
    flex: 1,
    marginLeft: 240,
    padding: '24px 32px',
    maxWidth: 1200,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
    margin: 0,
  },
  badge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 10px',
    borderRadius: 12,
    background: '#e8f5e9',
    color: '#2e7d32',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  tabs: {
    display: 'flex',
    gap: 4,
    borderBottom: '1px solid var(--luc-border, #e0e0e0)',
    marginBottom: 24,
    paddingBottom: 0,
  },
  tab: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 16px',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--luc-text-muted, #888)',
    textDecoration: 'none',
    borderBottom: '2px solid transparent',
    marginBottom: -1,
    transition: 'all 0.15s',
  },
  tabActive: {
    color: 'var(--luc-accent, #2563eb)',
    borderBottomColor: 'var(--luc-accent, #2563eb)',
    fontWeight: 600,
  },
  content: {
    minHeight: 400,
  },
};
