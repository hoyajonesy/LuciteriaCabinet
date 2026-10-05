/**
 * FR-7.5 — Shared one-click unsubscribe token module.
 *
 * Single source of truth for generating and verifying the signed token carried
 * by watchlist stock-alert emails. Imported by both the email dispatcher
 * (shopify-webhooks.server.js, which builds the unsubscribe URL) and the
 * unsubscribe route (api.unsubscribe-watchlist.jsx, which verifies it).
 *
 * The token is HMAC-SHA256(userId), so the /api/unsubscribe-watchlist endpoint
 * can authenticate the request without a DB lookup. The user id travels in the
 * URL; the HMAC proves the link was minted by Luciteria.
 *
 * Security notes:
 * - In production we THROW if neither UNSUB_SECRET nor SESSION_SECRET is set,
 *   rather than silently falling back to a well-known constant (which would let
 *   anyone forge an unsubscribe link for any user id).
 * - Verification uses crypto.timingSafeEqual on equal-length buffers to avoid
 *   leaking the expected digest through comparison timing.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

function getSecret() {
  const s = process.env.UNSUB_SECRET || process.env.SESSION_SECRET;
  if (!s && process.env.NODE_ENV === "production") {
    throw new Error(
      "UNSUB_SECRET or SESSION_SECRET must be set in production for unsubscribe token signing"
    );
  }
  return s || "luciteria-unsub-dev-only";
}

/**
 * Generate the signed unsubscribe token for a user.
 * @param {string} userId
 * @returns {string} 64-char lowercase hex HMAC-SHA256 digest
 */
export function generateUnsubToken(userId) {
  return createHmac("sha256", getSecret()).update(String(userId)).digest("hex");
}

/**
 * Constant-time verification of an unsubscribe token.
 * @param {string} userId
 * @param {string} token - the hex token from the URL
 * @returns {boolean}
 */
export function verifyUnsubToken(userId, token) {
  if (!userId || !token) return false;
  const expected = generateUnsubToken(userId);
  // timingSafeEqual requires equal-length buffers; bail early on mismatch so we
  // never throw on a malformed/short token.
  if (token.length !== expected.length) return false;
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(token, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
