/**
 * /app index — redirects to the cabinet dashboard.
 * Auth is checked at the dashboard level.
 */
import { redirect } from "@remix-run/node";
export const loader = () => redirect("/app/cabinet");
export default function AppIndex() { return null; }
