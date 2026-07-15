/**
 * Admin: Curation Queue (Phase 3 — Placeholder)
 * Admin approval queue for custom curation requests.
 */
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import AppNav from "../components/AppNav.jsx";

export async function loader() {
  return json({ phase3Enabled: false });
}

export default function AdminCurationQueue() {
  return (
    <div style={styles.layout}>
      <AppNav mode="admin" />
      <main style={styles.main}>
        <h2 style={styles.title}>Curation Queue</h2>

        <div style={styles.placeholder}>
          <span style={{ fontSize: "48px" }}>🎁</span>
          <h3 style={{ margin: "12px 0 8px", fontSize: "20px", fontWeight: 700 }}>Phase 3 — Coming Soon</h3>
          <p style={{ maxWidth: "500px", marginInline: "auto", fontSize: "14px", color: "#6B7280", lineHeight: 1.6 }}>
            The curation queue will allow you to review and approve custom element shipment
            requests from subscribers. Each request will show the user's collection gaps,
            preferences, and suggested box contents.
          </p>

          <div style={styles.mockQueue}>
            <div style={styles.mockHeader}>
              <span>Request ID</span>
              <span>Customer</span>
              <span>Type</span>
              <span>Elements</span>
              <span>Status</span>
              <span>Action</span>
            </div>
            {[1, 2, 3].map(i => (
              <div key={i} style={styles.mockRow}>
                <span style={styles.skeleton} />
                <span style={{ ...styles.skeleton, width: "80px" }} />
                <span style={{ ...styles.skeleton, width: "60px" }} />
                <span style={{ ...styles.skeleton, width: "40px" }} />
                <span style={{ ...styles.skeleton, width: "50px" }} />
                <span style={{ ...styles.skeleton, width: "70px" }} />
              </div>
            ))}
          </div>

          <div style={styles.infoBox}>
            <h4 style={{ margin: "0 0 8px" }}>🔧 When Phase 3 Activates</h4>
            <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", lineHeight: 1.8 }}>
              <li>Users can request "Send me N missing elements per quarter"</li>
              <li>System generates curated box from their collection gaps</li>
              <li>Admin reviews and approves each box before fulfillment</li>
              <li>Fixed cadence, fixed box size, controlled SKU pool</li>
            </ul>
          </div>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "900px" },
  title: { margin: "0 0 24px", fontSize: "24px", fontWeight: 700 },
  placeholder: { textAlign: "center", padding: "32px" },
  mockQueue: { margin: "24px auto", maxWidth: "600px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB", overflow: "hidden", textAlign: "left" },
  mockHeader: { display: "flex", gap: "12px", padding: "10px 16px", backgroundColor: "#F9FAFB", fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase" },
  mockRow: { display: "flex", gap: "12px", padding: "12px 16px", borderTop: "1px solid #F3F4F6" },
  skeleton: { display: "inline-block", width: "60px", height: "14px", backgroundColor: "#F3F4F6", borderRadius: "4px" },
  infoBox: { margin: "24px auto", maxWidth: "500px", padding: "20px", backgroundColor: "#F0F9FF", borderRadius: "12px", border: "1px solid #BAE6FD", textAlign: "left" },
};
