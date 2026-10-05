/**
 * /unsubscribe-confirmed — standalone, no-login confirmation page shown after a
 * successful one-click watchlist email unsubscribe (POST to
 * /api/unsubscribe-watchlist). Intentionally has no AppNav and requires no auth,
 * so a logged-out recipient clicking the email link sees a clear confirmation.
 */
export default function UnsubscribeConfirmed() {
  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.brand}>Luciteria Collector Cabinet</div>
        <div style={s.check}>✓</div>
        <h1 style={s.h1}>You've been unsubscribed</h1>
        <p style={s.p}>
          You'll no longer receive wishlist stock email alerts. You can re-enable
          them any time from your notification preferences in your Collector
          Cabinet.
        </p>
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
    textAlign: "center",
    boxShadow: "0 2px 10px rgba(0,0,0,0.05)",
  },
  brand: { fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#1976D2", marginBottom: 16 },
  check: { width: 56, height: 56, lineHeight: "56px", borderRadius: "50%", background: "#e8f5e9", color: "#2e7d32", fontSize: 28, fontWeight: 800, margin: "0 auto 16px" },
  h1: { fontSize: 22, fontWeight: 800, color: "#1a1a2e", margin: "0 0 12px" },
  p: { fontSize: 14, color: "#555", lineHeight: 1.55, margin: 0 },
};
