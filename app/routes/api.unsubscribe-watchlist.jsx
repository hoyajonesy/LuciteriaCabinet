/**
 * One-click watchlist email unsubscribe — /api/unsubscribe-watchlist?uid=<id>&token=<hex>
 *
 * Supports both GET (email client link click) and POST (RFC 8058 one-click).
 * Verifies the HMAC token, turns off watchlistEmailAlerts, and redirects to
 * a confirmation page (GET) or returns 200 JSON (POST).
 */
import { json, redirect } from "@remix-run/node";
import { createHmac } from "node:crypto";
import { updatePreferences } from "../lib/notifications-db.server";

function verifyToken(userId, token) {
  const secret = process.env.UNSUB_SECRET || process.env.SESSION_SECRET || "luciteria-unsub";
  const expected = createHmac("sha256", secret).update(userId).digest("hex");
  return expected === token;
}

async function handleUnsubscribe(request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return { error: "Missing token", status: 400 };
  }

  // Token is HMAC(userId); uid is carried in the URL so we can verify without a
  // full-table scan.
  const userId = url.searchParams.get("uid");
  if (!userId) return { error: "Missing uid", status: 400 };

  if (!verifyToken(userId, token)) {
    return { error: "Invalid token", status: 403 };
  }

  await updatePreferences(userId, { watchlistEmailAlerts: false });
  return { ok: true };
}

export const loader = async ({ request }) => {
  const result = await handleUnsubscribe(request);
  if (result.error) return json({ error: result.error }, { status: result.status });
  // GET: redirect to confirmation page
  return redirect("/app/cabinet/notifications/preferences?unsubscribed=1");
};

export const action = async ({ request }) => {
  const result = await handleUnsubscribe(request);
  if (result.error) return json({ error: result.error }, { status: result.status });
  return json({ ok: true });
};
