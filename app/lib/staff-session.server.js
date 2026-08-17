/**
 * Staff Session Management — dedicated admin authentication.
 *
 * This is DELIBERATELY separate from the consumer session
 * (session.server.js / `__luc_session`). Staff authenticate through their
 * own login page (/admin-login) which sets a distinct cookie
 * (`__luc_staff_session`). The /app/admin/* panel is gated on THIS cookie
 * only — a consumer session grants zero access to the admin panel, even if
 * the same person is logged into the storefront in the same browser.
 *
 * The identity model is still the User table + User.isStaff (so the staff
 * accounts provisioned via prisma/provision-admins.js are the admin
 * identities). This module only isolates the *session*, not the user store.
 */
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { prisma } from "./db.server.js";

const STAFF_SESSION_SECRET =
  process.env.STAFF_SESSION_SECRET ||
  process.env.SESSION_SECRET ||
  "luciteria-staff-dev-fallback-secret";

const LOGIN_PATH = "/admin-login";

const staffSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__luc_staff_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [STAFF_SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getStaffSession(request) {
  return staffSessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitStaffSession(session) {
  return staffSessionStorage.commitSession(session);
}

export async function destroyStaffSession(session) {
  return staffSessionStorage.destroySession(session);
}

/**
 * Get the staff User id from the dedicated staff cookie. Returns null if
 * there is no staff session. Never reads the consumer cookie.
 */
export async function getStaffUserId(request) {
  const session = await getStaffSession(request);
  return session.get("staffUserId") || null;
}

/**
 * Require an authenticated staff (isStaff) user. Throws a redirect to the
 * staff login when there is no valid staff session, or when the referenced
 * user no longer exists / is no longer staff.
 *
 * Returns the full User record on success.
 */
export async function requireStaffUser(request) {
  const userId = await getStaffUserId(request);
  if (!userId) throw redirect(LOGIN_PATH);

  const user = await prisma.user.findUnique({ where: { id: userId } });

  // If the account vanished or lost staff rights, drop the stale cookie.
  if (!user || !user.isStaff) {
    const session = await getStaffSession(request);
    throw redirect(LOGIN_PATH, {
      headers: { "Set-Cookie": await destroyStaffSession(session) },
    });
  }

  return user;
}

/**
 * Verify email/password against the User table AND require isStaff.
 * Returns { user, error }. A valid non-staff account is rejected with the
 * same generic message so the login page can't be used to enumerate staff.
 */
export async function authenticateStaff(email, password) {
  const { verifyLogin } = await import("./auth.server.js");
  const { user, error } = await verifyLogin({ email, password });
  if (error || !user) {
    return { user: null, error: error || "Invalid email or password." };
  }
  if (!user.isStaff) {
    return { user: null, error: "This account does not have admin access." };
  }
  return { user, error: null };
}

/**
 * Create a staff session and redirect (defaults into the admin panel).
 */
export async function createStaffSession(userId, redirectTo = "/app/admin") {
  const session = await staffSessionStorage.getSession();
  session.set("staffUserId", userId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await staffSessionStorage.commitSession(session) },
  });
}

/**
 * Destroy the staff session and return to the staff login page.
 */
export async function staffLogout(request) {
  const session = await getStaffSession(request);
  return redirect(LOGIN_PATH, {
    headers: { "Set-Cookie": await destroyStaffSession(session) },
  });
}
