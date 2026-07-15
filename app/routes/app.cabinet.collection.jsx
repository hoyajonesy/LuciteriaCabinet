/**
 * Legacy /app/cabinet/collection route.
 * The collection grid has been consolidated into the Periodic Table view.
 * Redirect to keep old links working.
 */
import { redirect } from "@remix-run/node";

export const loader = () => redirect("/app/cabinet/periodic-table");

export default function CollectionRedirect() {
  return null;
}
