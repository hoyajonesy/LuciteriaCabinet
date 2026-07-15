/**
 * User: Curation Request (Phase 3 — Disabled UI)
 * Shows "Coming Soon" placeholder for custom curation requests.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getUserId } from "../lib/session.server.js";
import AppNav from "../components/AppNav.jsx";

export async function loader({ request }) {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  return json({ userId });
}

export default function CurationRequestPage() {
  return (
    <div style={styles.layout}>
      <AppNav mode="customer" />
      <main style={styles.main}>
        <h2 style={styles.title}>Custom Curation</h2>

        <div style={styles.hero}>
          <span style={styles.heroIcon}>🎁</span>
          <h3 style={styles.heroTitle}>Personalized Element Shipments</h3>
          <p style={styles.heroDesc}>
            Tell us what you're missing, and we'll curate a custom box of elements
            tailored to your collection. Choose how many elements and how often.
          </p>
        </div>

        <div style={styles.features}>
          <div style={styles.feature}>
            <span>🔍</span>
            <div>
              <strong>Gap Analysis</strong>
              <p>We analyze your collection to find what's missing</p>
            </div>
          </div>
          <div style={styles.feature}>
            <span>📦</span>
            <div>
              <strong>Custom Box Sizes</strong>
              <p>Choose 3, 5, or 10 elements per shipment</p>
            </div>
          </div>
          <div style={styles.feature}>
            <span>📅</span>
            <div>
              <strong>Quarterly Cadence</strong>
              <p>Receive curated boxes every 3 months</p>
            </div>
          </div>
          <div style={styles.feature}>
            <span>✅</span>
            <div>
              <strong>Admin Reviewed</strong>
              <p>Every box is personally approved before shipping</p>
            </div>
          </div>
        </div>

        <div style={styles.cta}>
          <button style={styles.disabledBtn} disabled>
            Request Custom Box
          </button>
          <p style={styles.phase}>
            🚧 This feature is coming in Phase 3.
            <br />
            Contact us directly for custom curation requests in the meantime.
          </p>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "700px" },
  title: { margin: "0 0 24px", fontSize: "24px", fontWeight: 700 },
  hero: { textAlign: "center", padding: "40px 24px", backgroundColor: "#fff", borderRadius: "16px", border: "1px solid #E5E7EB", marginBottom: "24px" },
  heroIcon: { fontSize: "48px", display: "block", marginBottom: "12px" },
  heroTitle: { margin: "0 0 8px", fontSize: "22px", fontWeight: 700, color: "#111827" },
  heroDesc: { margin: 0, fontSize: "15px", color: "#6B7280", lineHeight: 1.6, maxWidth: "500px", marginInline: "auto" },
  features: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "24px" },
  feature: {
    display: "flex", gap: "12px", padding: "16px", backgroundColor: "#fff",
    borderRadius: "10px", border: "1px solid #E5E7EB", fontSize: "13px",
  },
  cta: { textAlign: "center", padding: "32px", backgroundColor: "#F9FAFB", borderRadius: "12px", border: "1px dashed #D1D5DB" },
  disabledBtn: {
    padding: "12px 32px", backgroundColor: "#E5E7EB", color: "#9CA3AF",
    border: "none", borderRadius: "10px", fontSize: "16px", fontWeight: 600, cursor: "not-allowed",
  },
  phase: { marginTop: "12px", fontSize: "13px", color: "#9CA3AF", lineHeight: 1.6 },
};
