/**
 * Admin Users layout — /app/admin/users
 *
 * Pass-through layout so that the list (index route) and the per-user
 * detail route (`$userId`) both render correctly. The shared admin chrome
 * (nav + badges) is provided by the parent `app.admin.jsx` layout.
 *
 *   /app/admin/users            → app.admin.users._index.jsx (list)
 *   /app/admin/users/:userId    → app.admin.users.$userId.jsx (detail)
 */
import { Outlet } from "@remix-run/react";

export default function AdminUsersLayout() {
  return <Outlet />;
}
