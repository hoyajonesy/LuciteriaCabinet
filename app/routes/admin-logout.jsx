/**
 * Staff Logout — /admin-logout
 * Destroys the dedicated staff session cookie and returns to /admin-login.
 */
import { staffLogout } from "../lib/staff-session.server.js";

export const action = async ({ request }) => {
  return staffLogout(request);
};

export const loader = async ({ request }) => {
  return staffLogout(request);
};
