/**
 * Shared navigation sidebar for the Collector Cabinet.
 * Faithful port of the collection.html / main-dashboard.html wireframe sidebar
 * (Tailwind, gray theme, FontAwesome icons).
 *
 * Customer nav = exactly 5 items per product spec:
 *   Dashboard · Collection · Wishlist · Shop · Notifications
 * (The "Progress" item shown in some wireframes is intentionally omitted.)
 */
import { Link, useLocation, Form } from "@remix-run/react";

const CUSTOMER_NAV = [
  { label: "Dashboard", path: "/app/cabinet", icon: "fa-gauge", exact: true },
  { label: "Collection", path: "/app/cabinet/periodic-table", icon: "fa-table-cells" },
  { label: "My Ledger", path: "/app/cabinet/summary", icon: "fa-list" },
  { label: "Wishlist", path: "/app/cabinet/wishlist", icon: "fa-heart" },
  { label: "Shop", path: "/app/cabinet/shop", icon: "fa-cart-shopping" },
  { label: "Notifications", path: "/app/cabinet/notifications", icon: "fa-bell", badgeKey: "unread" },
];

const ADMIN_NAV = [
  { label: "Overview", path: "/app/admin", icon: "fa-chart-line", exact: true },
  { label: "Users", path: "/app/admin/users", icon: "fa-users" },
  { label: "Demand", path: "/app/admin/demand", icon: "fa-fire" },
  { label: "Analytics", path: "/app/admin/analytics", icon: "fa-chart-simple" },
  { label: "Operations", path: "/app/admin/operations", icon: "fa-gear" },
  { label: "Customers", path: "/app/admin/customers", icon: "fa-address-book" },
  { label: "Pricing", path: "/app/admin/pricing", icon: "fa-dollar-sign" },
];

export default function AppNav({
  mode = "customer",
  customerName = "Collector",
  currentPath = null,
  unreadCount = 0,
}) {
  const location = useLocation();
  const navItems = mode === "admin" ? ADMIN_NAV : CUSTOMER_NAV;
  const activePath = currentPath || location.pathname;

  const linkBase =
    "flex items-center gap-3 px-5 py-2.5 text-luc-text hover:bg-luc-gray transition-colors";
  const linkActive =
    "flex items-center gap-3 px-5 py-2.5 bg-luc-bluegray text-luc-blue font-medium border-l-2 border-luc-blue";

  return (
    <aside className="luc-sidebar w-56 flex-shrink-0 bg-white border-r border-luc-border flex flex-col min-h-screen">
      {/* Brand */}
      <Link
        to="/app/cabinet"
        className="px-5 py-4 border-b border-luc-border flex items-center gap-2"
        style={{ textDecoration: "none" }}
      >
        <img src="/logo.png" alt="Luciteria Science" className="brand-text h-8 w-auto" />
        <i className="fa-solid fa-atom brand-icon text-lg text-luc-blue" aria-hidden="true"></i>
      </Link>

      {/* Nav */}
      <nav className="text-sm py-2 flex-1">
        {navItems.map((item) => {
          const content = (
            <>
              <i className={`fa-solid ${item.icon} w-4`}></i>
              <span className="link-label">{item.label}</span>
              {item.badgeKey === "unread" && unreadCount > 0 && (
                <span className="ml-auto text-xs bg-gray-300 text-gray-700 rounded-full px-2">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </>
          );

          if (item.external) {
            return (
              <a
                key={item.label}
                href={item.href}
                target="_blank"
                rel="noreferrer"
                className={linkBase}
              >
                {content}
              </a>
            );
          }

          const isActive = item.exact
            ? activePath === item.path || activePath === item.path + "/"
            : activePath === item.path || activePath.startsWith(item.path + "/");

          return (
            <Link
              key={item.label}
              to={item.path}
              className={isActive ? linkActive : linkBase}
              style={{ textDecoration: "none" }}
            >
              {content}
            </Link>
          );
        })}
      </nav>

      {/* Switch mode */}
      <div className="border-t border-gray-200 px-5 py-3">
        {mode === "customer" ? (
          <Link to="/app/admin" className="text-xs text-gray-500 hover:text-gray-700 footer-text" style={{ textDecoration: "none" }}>
            Switch to Admin &rarr;
          </Link>
        ) : (
          <Link to="/app/cabinet" className="text-xs text-gray-500 hover:text-gray-700 footer-text" style={{ textDecoration: "none" }}>
            &larr; Back to Cabinet
          </Link>
        )}
      </div>

      {/* User + logout */}
      <div className="border-t border-gray-200 px-5 py-3 flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-gray-500">
          <i className="fa-solid fa-user text-xs"></i>
        </div>
        <div className="footer-text">
          <p className="text-xs font-medium text-gray-700 leading-tight">{customerName}</p>
          <Form method="post" action="/logout">
            <button
              type="submit"
              className="text-[10px] text-gray-400 hover:text-gray-600"
              style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontFamily: "inherit" }}
            >
              Log Out
            </button>
          </Form>
        </div>
      </div>
    </aside>
  );
}
