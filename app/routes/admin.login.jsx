/**
 * Legacy Admin Login Redirect — /admin/login
 * 
 * This route now redirects to the new staff login at /admin-login.
 * The legacy AdminUser system is being deprecated in favor of User.isStaff.
 */
import { redirect } from "@remix-run/node";

export const loader = async () => {
  return redirect("/admin-login", 301);
};

export const action = async () => {
  return redirect("/admin-login", 301);
};
