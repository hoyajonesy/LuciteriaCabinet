/**
 * Logout Route — POST /logout
 * Destroys the session and redirects to welcome.
 */
import { redirect } from "@remix-run/node";
import { logout } from "../lib/session.server";

export const action = async ({ request }) => {
  return logout(request);
};

export const loader = async () => {
  // GET requests also log out (for simple links)
  return redirect("/onboarding/welcome");
};

export default function Logout() {
  return null;
}
