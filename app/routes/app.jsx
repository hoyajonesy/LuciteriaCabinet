/**
 * App layout — wraps all /app/* routes.
 * In production this would use AppBridge provider.
 */
import { Outlet } from "@remix-run/react";

export default function AppLayout() {
  return <Outlet />;
}
