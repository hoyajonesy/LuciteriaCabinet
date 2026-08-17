/**
 * Legacy Admin Login Redirect — /admin/login
 *
 * This route now redirects to the new staff login at /admin-login.
 * The legacy AdminUser system is being deprecated in favor of User.isStaff.
 *
 * NOTE: We use a 302 (temporary) redirect, NOT 301. A 301 is cached
 * permanently by browsers and cannot be cleared by clearing cookies, which
 * makes the redirect "stick" and is very hard for users to recover from.
 */
import { redirect } from "@remix-run/node";

export const loader = async () => {
  return redirect("/admin-login");
};

export const action = async () => {
  return redirect("/admin-login");
};
