/**
 * One-click watchlist email unsubscribe — /api/unsubscribe-watchlist?uid=<id>&token=<hex>
 *
 * GET  → renders a standalone, no-login confirmation page with a POST form.
 *        GET never changes any database state (so email security scanners that
 *        pre-fetch links cannot silently unsubscribe people).
 * POST → verifies the HMAC token, turns off watchlistEmailAlerts, then redirects
 *        to /unsubscribe-confirmed. Also serves RFC 8058 one-click (the email
 *        client auto-POSTs the List-Unsubscribe URL).
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { verifyUnsubToken } from "../lib/unsub-token.server";
import { updatePreferences } from "../lib/notifications-db.server";

function readParams(request) {
  const url = new URL(request.url);
  return {
    uid: url.searchParams.get("uid"),
    token: url.searchParams.get("token"),
  };
}

// GET: do NOT mutate state. Validate inputs enough to show a sensible page,
// then render a standalone confirmation form that POSTs back to this route.
export const loader = async ({ request }) => {
  const { uid, token } = readParams(request);
  if (!uid || !token) {
    return json({ valid: false, uid: null, token: null }, { status: 400 });
  }
  const valid = verifyUnsubToken(uid, token);
  return json({ valid, uid, token }, { status: valid ? 200 : 403 });
};

// POST: perform the unsubscribe after re-verifying the token.
export const action = async ({ request }) => {
  const { uid, token } = readParams(request);
  if (!uid || !token) {
    return json({ error: "Missing uid or token" }, { status: 400 });
  }
  if (!verifyUnsubToken(uid, token)) {
    return json({ error: "Invalid token" }, { status: 403 });
  }
  await updatePreferences(uid, { watchlistEmailAlerts: false });
  return redirect("/unsubscribe-confirmed");
};

export default function UnsubscribeWatchlist() {
  const { valid, uid, token } = useLoaderData();

  if (!valid) {
    return (
      <Shell>
        <h1 style={s.h1}>Link not valid</h1>
        <p style={s.p}>
          This unsubscribe link is missing or has expired. You can manage all your
          alert settings from your Luciteria Collector Cabinet notification
          preferences.
        </p>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 style={s.h1}>Stop wishlist stock emails?</h1>
      <p style={s.p}>
        You're about to stop receiving wishlist stock emails from Luciteria
        Collector Cabinet. In-app alerts and other emails are not affected, and you
        can turn this back on any time in your notification preferences.
      </p>
      <form method="post" action={`/api/unsubscribe-watchlist?uid=${encodeURIComponent(uid)}&token=${encodeURIComponent(token)}`}>
        <button type="submit" style={s.button}>
          Confirm — Stop these emails
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }) {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>Luciteria Collector Cabinet</div>
        {children}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f8f9fa",
    fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
    padding: 20,
  },
  card: {
    background: "#fff",
    border: "1px solid #e9ecef",
    borderRadius: 14,
    padding: "32px 36px",
    maxWidth: 460,
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  brand: { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#1976D2", marginBottom: 12 },
  h1: { fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 12px" },
  p: { fontSize: 14, color: "#555", lineHeight: 1.55, margin: "0 0 22px" },
  button: { padding: "12px 22px", background: "#1976D2", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
};
