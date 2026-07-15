/**
 * Admin Layout — /admin/*
 * Provides sidebar navigation and admin authentication gate.
 * Design reference: admin-users.html sidebar
 */
import { json } from "@remix-run/node";
import { Outlet, useLoaderData, Link, useLocation, Form } from "@remix-run/react";
import { requireAdmin } from "../lib/admin-session.server.js";
import { enforceSubdomainRouting } from "../lib/subdomain-guard.server.js";

export const loader = async ({ request }) => {
  // Subdomain guard: on the consumer host (app.luciteria.com) /admin/* must 404.
  // Running this before requireAdmin() ensures a clean 404 wins over the
  // unauthenticated 302→/admin/login redirect that requireAdmin would throw.
  enforceSubdomainRouting(request);

  const url = new URL(request.url);
  // Allow login and logout routes to pass through without auth
  if (url.pathname === "/admin/login" || url.pathname === "/admin/logout") {
    return json({ admin: null });
  }
  const admin = await requireAdmin(request);
  return json({ admin });
};

const NAV_ITEMS = [
  { label: "Dashboard", path: "/admin",           icon: "📊", match: "exact" },
  { label: "Users",     path: "/admin/users",      icon: "👥" },
  { label: "Admins",    path: "/admin/admins",     icon: "🛡️" },
  { label: "Analytics", path: "/admin/analytics",  icon: "📈" },
  { label: "Formats",   path: "/admin/formats",    icon: "🧊" },
  { label: "Sets",      path: "/admin/sets",       icon: "📦" },
  { label: "Notifications", path: "/admin/notifications", icon: "🔔" },
  { label: "Milestones",path: "/admin/milestones", icon: "🏆" },
];

export default function AdminLayout() {
  const { admin } = useLoaderData();
  const location = useLocation();

  // For login/logout pages, render without sidebar
  if (!admin) {
    return <Outlet context={{ admin: null }} />;
  }

  const isActive = (item) => {
    if (item.match === "exact") {
      return location.pathname === item.path || location.pathname === item.path + "/";
    }
    return location.pathname.startsWith(item.path);
  };

  return (
    <div style={styles.layout}>
      {/* Sidebar */}
      <aside style={styles.sidebar}>
        {/* Brand */}
        <div style={styles.brand}>
          <div style={styles.brandIcon}>🧊</div>
          <div>
            <div style={styles.brandTitle}>Luciteria</div>
            <div style={styles.brandSub}>Admin Console</div>
          </div>
        </div>

        {/* Nav */}
        <nav style={styles.nav}>
          {NAV_ITEMS.map(item => (
            <Link
              key={item.path}
              to={item.path}
              style={{
                ...styles.navItem,
                ...(isActive(item) ? styles.navItemActive : {}),
              }}
            >
              <span style={styles.navIcon}>{item.icon}</span>
              {item.label}
            </Link>
          ))}
        </nav>

        {/* Footer */}
        <div style={styles.sidebarFooter}>
          <div style={styles.adminInfo}>
            <span style={styles.adminAvatar}>
              {admin.name.charAt(0).toUpperCase()}
            </span>
            <div>
              <div style={styles.adminName}>{admin.name}</div>
              <div style={styles.adminEmail}>{admin.email}</div>
            </div>
          </div>
          <Form method="post" action="/admin/logout">
            <button type="submit" style={styles.logoutBtn}>
              ↩ Sign Out
            </button>
          </Form>
        </div>
      </aside>

      {/* Main */}
      <main style={styles.main}>
        <Outlet context={{ admin }} />
      </main>
    </div>
  );
}

const styles = {
  layout: {
    display: "flex",
    minHeight: "100vh",
    background: "#f3f4f6",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  sidebar: {
    width: 230,
    background: "#fff",
    borderRight: "1px solid #d1d5db",
    display: "flex",
    flexDirection: "column",
    position: "fixed",
    top: 0,
    left: 0,
    bottom: 0,
    zIndex: 50,
  },
  brand: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "20px 20px",
    borderBottom: "1px solid #e5e7eb",
  },
  brandIcon: {
    width: 32,
    height: 32,
    background: "#e5e7eb",
    border: "1px solid #9ca3af",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 16,
  },
  brandTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: "#1f2937",
  },
  brandSub: {
    fontSize: 11,
    color: "#9ca3af",
  },
  nav: {
    flex: 1,
    padding: "16px 0",
    fontSize: 14,
    overflowY: "auto",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "10px 20px",
    color: "#4b5563",
    textDecoration: "none",
    transition: "all 0.15s",
    borderLeft: "2px solid transparent",
  },
  navItemActive: {
    background: "#f3f4f6",
    color: "#111827",
    fontWeight: 600,
    borderLeftColor: "#374151",
  },
  navIcon: {
    width: 16,
    textAlign: "center",
    fontSize: 14,
  },
  sidebarFooter: {
    padding: "16px 20px",
    borderTop: "1px solid #e5e7eb",
  },
  adminInfo: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  adminAvatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "#374151",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 600,
    flexShrink: 0,
  },
  adminName: {
    fontSize: 12,
    fontWeight: 600,
    color: "#1f2937",
  },
  adminEmail: {
    fontSize: 10,
    color: "#9ca3af",
  },
  logoutBtn: {
    background: "none",
    border: "none",
    padding: 0,
    fontSize: 12,
    color: "#6b7280",
    cursor: "pointer",
    textDecoration: "none",
  },
  main: {
    flex: 1,
    marginLeft: 230,
    padding: "32px 40px",
    maxWidth: 1200,
  },
};
