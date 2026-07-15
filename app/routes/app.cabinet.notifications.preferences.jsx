/**
 * Notification Preferences (Phase 2D)
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { useState } from "react";
import AppNav from "../components/AppNav";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { getPreferences, updatePreferences } from "../lib/notifications-db.server";

const ROWS = [
  { key: "Milestone", label: "Milestones", desc: "When you unlock a collection achievement" },
  { key: "NearCompletion", label: "Near completion", desc: "When you're close to completing a group" },
  { key: "Restock", label: "Wishlist restocks", desc: "When a wanted element comes back in stock" },
  { key: "NewArrival", label: "New arrivals", desc: "When relevant new products are added" },
];

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");
  const pref = await getPreferences(userId);
  return json({
    pref,
    authUser: { userType: authUser.userType, isSubscriber: authUser.isSubscriber },
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  const form = await request.formData();

  const boolField = (name) => form.get(name) === "on";
  const data = {
    weeklyDigest: boolField("weeklyDigest"),
    maxEmailsPerWeek: Math.max(0, Math.min(20, parseInt(form.get("maxEmailsPerWeek") || "5", 10))),
  };
  for (const r of ROWS) {
    data[`inApp${r.key}`] = boolField(`inApp${r.key}`);
    data[`email${r.key}`] = boolField(`email${r.key}`);
  }
  await updatePreferences(userId, data);
  return json({ ok: true });
};

export default function NotificationPreferences() {
  const { pref, authUser } = useLoaderData();
  const fetcher = useFetcher();
  const saved = fetcher.data?.ok && fetcher.state === "idle";

  return (
    <div style={styles.layout}>
      <AppNav currentPath="/app/cabinet/notifications" userType={authUser.userType} isSubscriber={authUser.isSubscriber} />
      <main style={styles.main} className="luc-main">
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Notification Preferences</h1>
            <p style={styles.subtitle}>Choose how you'd like to hear from us.</p>
          </div>
          <Link to="/app/cabinet/notifications" style={styles.backLink}>← Back to inbox</Link>
        </div>

        <fetcher.Form method="post">
          <div style={styles.card}>
            <div style={styles.tableHead}>
              <span style={{ flex: 1 }}>Notification type</span>
              <span style={styles.colHead}>In-app</span>
              <span style={styles.colHead}>Email</span>
            </div>
            {ROWS.map((r) => (
              <div key={r.key} style={styles.row}>
                <div style={{ flex: 1 }}>
                  <div style={styles.rowLabel}>{r.label}</div>
                  <div style={styles.rowDesc}>{r.desc}</div>
                </div>
                <Toggle name={`inApp${r.key}`} defaultChecked={pref[`inApp${r.key}`]} />
                <Toggle name={`email${r.key}`} defaultChecked={pref[`email${r.key}`]} />
              </div>
            ))}
          </div>

          <div style={styles.card}>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <div style={styles.rowLabel}>Weekly digest</div>
                <div style={styles.rowDesc}>A weekly summary of low-priority activity</div>
              </div>
              <Toggle name="weeklyDigest" defaultChecked={pref.weeklyDigest} wide />
            </div>
            <div style={styles.row}>
              <div style={{ flex: 1 }}>
                <div style={styles.rowLabel}>Max emails per week</div>
                <div style={styles.rowDesc}>We'll never exceed this limit</div>
              </div>
              <input type="number" name="maxEmailsPerWeek" min="0" max="20" defaultValue={pref.maxEmailsPerWeek} style={styles.numberInput} />
            </div>
          </div>

          <div style={styles.actions}>
            {saved && <span style={styles.savedNote}>✓ Saved</span>}
            <button type="submit" style={styles.saveBtn} disabled={fetcher.state !== "idle"}>
              {fetcher.state !== "idle" ? "Saving…" : "Save Preferences"}
            </button>
          </div>
        </fetcher.Form>
      </main>
    </div>
  );
}

function Toggle({ name, defaultChecked, wide }) {
  const [on, setOn] = useState(!!defaultChecked);
  return (
    <label style={{ ...styles.toggleWrap, width: wide ? 120 : 80 }}>
      <input type="checkbox" name={name} checked={on} onChange={(e) => setOn(e.target.checked)} style={{ display: "none" }} />
      <span style={{ ...styles.toggleTrack, background: on ? "#1976D2" : "#ccc" }}>
        <span style={{ ...styles.toggleKnob, transform: on ? "translateX(18px)" : "translateX(0)" }} />
      </span>
    </label>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#f8f9fa" },
  main: { flex: 1, marginLeft: 240, padding: "24px 32px", maxWidth: 720 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  title: { fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 },
  subtitle: { fontSize: 14, color: "#666", margin: "4px 0 0" },
  backLink: { fontSize: 13, color: "#1976D2", textDecoration: "none", fontWeight: 600 },
  card: { background: "#fff", borderRadius: 12, border: "1px solid #e9ecef", padding: "8px 20px", marginBottom: 16 },
  tableHead: { display: "flex", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #f0f0f0", fontSize: 11, fontWeight: 700, textTransform: "uppercase", color: "#999" },
  colHead: { width: 80, textAlign: "center" },
  row: { display: "flex", alignItems: "center", padding: "14px 0", borderBottom: "1px solid #f5f5f5" },
  rowLabel: { fontSize: 14, fontWeight: 600, color: "#333" },
  rowDesc: { fontSize: 12, color: "#888", marginTop: 2 },
  toggleWrap: { display: "flex", justifyContent: "center", cursor: "pointer" },
  toggleTrack: { width: 38, height: 20, borderRadius: 20, position: "relative", transition: "background 0.2s", display: "inline-block" },
  toggleKnob: { position: "absolute", top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "#fff", transition: "transform 0.2s", boxShadow: "0 1px 2px rgba(0,0,0,0.2)" },
  numberInput: { width: 70, padding: "6px 10px", borderRadius: 8, border: "1px solid #ddd", fontSize: 14, textAlign: "center" },
  actions: { display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 12 },
  savedNote: { color: "#388E3C", fontSize: 13, fontWeight: 600 },
  saveBtn: { padding: "10px 24px", background: "#1976D2", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" },
};
