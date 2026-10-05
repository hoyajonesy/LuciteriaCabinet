/**
 * Core logic for one-click watchlist email unsubscribe, extracted from the
 * route (app/routes/api.unsubscribe-watchlist.jsx) so it can be unit-tested
 * without parsing JSX.
 *
 * Contract:
 *   - GET  must NEVER mutate state. evaluateUnsubGet() only validates the token
 *          and reports whether a confirmation form should be shown. This keeps
 *          email security scanners that pre-fetch links from silently
 *          unsubscribing people.
 *   - POST performs the actual change. performUnsubPost() re-verifies the token
 *          and, only on success, turns off watchlistEmailAlerts.
 */
import { verifyUnsubToken } from "./unsub-token.server.js";
import { updatePreferences } from "./notifications-db.server.js";

export function readUnsubParams(request) {
  const url = new URL(request.url);
  return {
    uid: url.searchParams.get("uid"),
    token: url.searchParams.get("token"),
  };
}

/**
 * GET handler core — pure validation, no side effects.
 * @returns {{ valid: boolean, uid: string|null, token: string|null, status: number }}
 */
export function evaluateUnsubGet(request) {
  const { uid, token } = readUnsubParams(request);
  if (!uid || !token) {
    return { valid: false, uid: null, token: null, status: 400 };
  }
  const valid = verifyUnsubToken(uid, token);
  return { valid, uid, token, status: valid ? 200 : 403 };
}

/**
 * POST handler core — verifies then mutates.
 * `update` is injectable so the mutation can be spied on in unit tests without
 * module mocking; it defaults to the real updatePreferences.
 * @returns {Promise<{ ok: true } | { error: string, status: number }>}
 */
export async function performUnsubPost(request, { update = updatePreferences } = {}) {
  const { uid, token } = readUnsubParams(request);
  if (!uid || !token) {
    return { error: "Missing uid or token", status: 400 };
  }
  if (!verifyUnsubToken(uid, token)) {
    return { error: "Invalid token", status: 403 };
  }
  await update(uid, { watchlistEmailAlerts: false });
  return { ok: true };
}
