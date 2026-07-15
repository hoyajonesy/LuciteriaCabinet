/**
 * Session Management Utilities
 * 
 * Handles cookie-based sessions for user authentication.
 * Uses Remix's createCookieSessionStorage for secure HTTP-only cookies.
 * 
 * TODO PRODUCTION: Replace with Shopify OAuth session management.
 * Shopify App Bridge will handle authentication via OAuth tokens.
 * This email/password session system is for prototype only.
 */
import { createCookieSessionStorage, redirect } from "@remix-run/node";

const SESSION_SECRET = process.env.SESSION_SECRET || "luciteria-dev-fallback-secret";

const sessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__luc_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 30, // 30 days
    path: "/",
    sameSite: "lax",
    secrets: [SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

/**
 * Get the session from the request
 */
export async function getSession(request) {
  return sessionStorage.getSession(request.headers.get("Cookie"));
}

/**
 * Commit (save) the session and return the Set-Cookie header
 */
export async function commitSession(session) {
  return sessionStorage.commitSession(session);
}

/**
 * Destroy the session (logout)
 */
export async function destroySession(session) {
  return sessionStorage.destroySession(session);
}

/**
 * Get the current user ID from the session.
 * Returns null if not logged in.
 */
export async function getUserId(request) {
  const session = await getSession(request);
  const userId = session.get("userId");
  return userId || null;
}

/**
 * Require a user to be logged in.
 * Redirects to /onboarding/welcome if not authenticated.
 */
export async function requireUserId(request) {
  const userId = await getUserId(request);
  if (!userId) {
    throw redirect("/onboarding/welcome");
  }
  return userId;
}

/**
 * Create a user session and redirect.
 */
export async function createUserSession(userId, redirectTo) {
  const session = await sessionStorage.getSession();
  session.set("userId", userId);
  return redirect(redirectTo, {
    headers: {
      "Set-Cookie": await sessionStorage.commitSession(session),
    },
  });
}

/**
 * Log out: destroy session and redirect to welcome page.
 */
export async function logout(request) {
  const session = await getSession(request);
  return redirect("/onboarding/welcome", {
    headers: {
      "Set-Cookie": await sessionStorage.destroySession(session),
    },
  });
}

/**
 * Get flash message from session (for toast notifications)
 */
export async function getFlashMessage(request) {
  const session = await getSession(request);
  const message = session.get("flashMessage") || null;
  const messageType = session.get("flashType") || "info";
  return { message, messageType, session };
}

/**
 * Set flash message in session
 */
export async function setFlashMessage(session, message, type = "info") {
  session.flash("flashMessage", message);
  session.flash("flashType", type);
}
