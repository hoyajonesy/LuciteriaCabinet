/**
 * Preferences Page (Phase 2)
 * 
 * Customer controls for subscription assignment behavior.
 * Added: notification preferences with email/webhook stubs.
 * Collection type aware. Light theme.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import AppNav from "../components/AppNav";

import * as db from "../data/mock-db.server";

export const loader = ({ request }) => {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer") || "cust_001";

  const customer = db.getCustomerById(customerId);
  const collectionType = customer?.collectionType || "lucite";
  const preferences = db.getPreferences(customerId);

  return json({ customer, preferences, customerId, collectionType });
};

const DUPLICATE_OPTIONS = [
  { value: "never", label: "Never send duplicates", description: "Only elements I don't already own. The purist's choice.", icon: "🚫" },
  { value: "missing_only", label: "Only send missing items", description: "Same as above, plus excludes previously shipped items.", icon: "🔍" },
  { value: "curated_subs", label: "Allow curated substitutions", description: "Allow thoughtful alternatives — even if it's something I own in a different format.", icon: "✨" },
  { value: "allow_if_limited", label: "Allow if inventory limited", description: "I'd rather get something than nothing. Send a duplicate if nothing else is available.", icon: "🔄" },
  { value: "surprise", label: "Surprise me", description: "I trust you. Send whatever you think is interesting.", icon: "🎲" },
];

const CATEGORY_OPTIONS = [
  "Lucite Cube", "Metal Bar", "Metal Cube", "Dome", "Bulk Sample",
  "Crystal", "Ampoule", "Display Case",
];

const FORMAT_OPTIONS = [
  "50mm", "31mm", "25.4mm", "10.1mm", "10mm", "15x60mm",
];

export default function PreferencesPage() {
  const { customer, preferences, collectionType } = useLoaderData();
  const prefs = preferences || {};

  return (
    <div style={styles.layout}>
      <AppNav mode="customer" customerName={customer?.firstName} collectionType={collectionType} />
      <main style={styles.main} className="luc-main">
        <h2 style={styles.title}>Your Preferences</h2>
        <p style={styles.subtitle}>
          Fine-tune how your subscription works. These settings guide our assignment engine
          when picking your next element.
        </p>

        {/* Collection Type (read-only in Phase 2) */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Collection Type</h3>
          <div style={styles.collectionTypeDisplay}>
            <span style={styles.ctIcon}>🧊</span>
            <div>
              <div style={styles.ctName}>{collectionType}</div>
              <div style={styles.ctNote}>🔒 Collection type is locked in the current phase. Multi-collection support coming soon.</div>
            </div>
          </div>
        </section>

        {/* Duplicate Handling */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Duplicate Handling</h3>
          <p style={styles.sectionDesc}>
            What should we do when your missing items are running low or out of stock?
          </p>
          <div style={styles.radioGroup}>
            {DUPLICATE_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                style={{
                  ...styles.radioCard,
                  ...(prefs.duplicateHandling === opt.value ? styles.radioCardSelected : {}),
                }}
              >
                <div style={styles.radioHeader}>
                  <span style={styles.radioIcon}>{opt.icon}</span>
                  <input
                    type="radio"
                    name="duplicateHandling"
                    value={opt.value}
                    defaultChecked={prefs.duplicateHandling === opt.value}
                    style={styles.radioInput}
                  />
                  <span style={styles.radioLabel}>{opt.label}</span>
                </div>
                <p style={styles.radioDesc}>{opt.description}</p>
              </label>
            ))}
          </div>
        </section>

        {/* Category Preferences */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Preferred Product Categories</h3>
          <p style={styles.sectionDesc}>
            Select the types of products you love most. We'll prioritize these in your assignments.
          </p>
          <div style={styles.checkboxGrid}>
            {CATEGORY_OPTIONS.map((cat) => (
              <label key={cat} style={styles.checkboxCard}>
                <input
                  type="checkbox"
                  defaultChecked={(prefs.preferredCategories || []).includes(cat)}
                  style={styles.checkbox}
                />
                <span>{cat}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Format Preferences */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Preferred Formats</h3>
          <div style={styles.checkboxGrid}>
            {FORMAT_OPTIONS.map((fmt) => (
              <label key={fmt} style={styles.checkboxCard}>
                <input
                  type="checkbox"
                  defaultChecked={(prefs.preferredFormats || []).includes(fmt)}
                  style={styles.checkbox}
                />
                <span>{fmt}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Budget */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Budget Preference</h3>
          <div style={styles.inputGroup}>
            <span style={styles.inputPrefix}>$</span>
            <input
              type="number"
              placeholder="No limit"
              defaultValue={prefs.budgetMaxUsd || ""}
              style={styles.textInput}
            />
            <span style={styles.inputSuffix}>per item</span>
          </div>
        </section>

        {/* Communication / Notifications */}
        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>Notification Preferences</h3>
          <p style={styles.sectionDesc}>
            Control how you hear from us. All notifications are logged to our system.
          </p>
          <div style={styles.toggleList}>
            <ToggleRow
              label="Email notifications"
              description="Shipment updates, assignment previews, collection milestones"
              checked={prefs.communicationEmail !== false}
            />
            <ToggleRow
              label="SMS notifications"
              description="Text alerts for shipments and rare item availability"
              checked={prefs.communicationSms === true}
            />
            <ToggleRow
              label="Shipment tracking alerts"
              description="Real-time tracking updates when your element ships"
              checked={prefs.shipmentNotifications !== false}
            />
            <ToggleRow
              label="Restock alerts"
              description="Get notified when wishlisted out-of-stock items become available"
              checked={prefs.restockAlerts !== false}
            />
            <ToggleRow
              label="Price change notices"
              description="Be notified when your grandfathered rate is about to expire"
              checked={true}
            />
            <ToggleRow
              label="Collection milestones"
              description="Celebrate when you hit 10, 25, 50, 75, 100, or 118 elements"
              checked={true}
            />
          </div>
        </section>

        {/* Save */}
        <div style={styles.saveRow}>
          <button style={styles.saveBtn}>Save Preferences</button>
          <span style={styles.saveNote}>Changes take effect for your next subscription assignment.</span>
        </div>
      </main>
    </div>
  );
}

function ToggleRow({ label, description, checked }) {
  return (
    <label style={styles.toggleRow}>
      <div style={styles.toggleInfo}>
        <span style={styles.toggleLabel}>{label}</span>
        <span style={styles.toggleDesc}>{description}</span>
      </div>
      <div style={{
        ...styles.toggle,
        background: checked ? "var(--luc-accent)" : "#d1d5db",
      }}>
        <div style={{
          ...styles.toggleKnob,
          transform: checked ? "translateX(18px)" : "translateX(2px)",
        }} />
      </div>
    </label>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: { marginLeft: 240, flex: 1, padding: "24px 40px 60px", maxWidth: 720 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 32px", lineHeight: 1.5 },
  section: { marginBottom: 36 },
  sectionTitle: { fontSize: 16, fontWeight: 700, color: "var(--luc-text)", marginBottom: 4 },
  sectionDesc: { fontSize: 13, color: "var(--luc-text-muted)", margin: "0 0 16px", lineHeight: 1.5 },
  collectionTypeDisplay: {
    display: "flex", alignItems: "center", gap: 12, padding: 16,
    background: "#EBF3FC", border: "1px solid #bfdbfe", borderRadius: 10, marginTop: 12,
  },
  ctIcon: { fontSize: 28 },
  ctName: { fontSize: 16, fontWeight: 700, color: "var(--luc-accent)", textTransform: "capitalize" },
  ctNote: { fontSize: 12, color: "var(--luc-text-muted)", marginTop: 2 },
  radioGroup: { display: "flex", flexDirection: "column", gap: 8 },
  radioCard: {
    display: "block", padding: 16, background: "#ffffff",
    border: "1px solid var(--luc-border)", borderRadius: 10, cursor: "pointer",
    transition: "border-color 0.15s ease",
  },
  radioCardSelected: { borderColor: "var(--luc-accent)", background: "#EBF3FC" },
  radioHeader: { display: "flex", alignItems: "center", gap: 10 },
  radioIcon: { fontSize: 18 },
  radioInput: { accentColor: "var(--luc-accent)" },
  radioLabel: { fontSize: 14, fontWeight: 600, color: "var(--luc-text)" },
  radioDesc: { fontSize: 12, color: "var(--luc-text-muted)", margin: "6px 0 0 28px", lineHeight: 1.4 },
  checkboxGrid: { display: "flex", flexWrap: "wrap", gap: 8 },
  checkboxCard: {
    display: "flex", alignItems: "center", gap: 8, padding: "8px 14px",
    background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 8, fontSize: 13, color: "var(--luc-text)", cursor: "pointer",
  },
  checkbox: { accentColor: "var(--luc-accent)" },
  inputGroup: { display: "flex", alignItems: "center", gap: 8 },
  inputPrefix: { fontSize: 16, color: "var(--luc-text-muted)", fontWeight: 600 },
  textInput: {
    padding: "8px 14px", background: "#ffffff",
    border: "1px solid var(--luc-border)", borderRadius: 8,
    color: "var(--luc-text)", fontSize: 14, width: 120, outline: "none",
  },
  inputSuffix: { fontSize: 13, color: "var(--luc-text-muted)" },
  toggleList: { display: "flex", flexDirection: "column", gap: 12 },
  toggleRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: 16, background: "#ffffff",
    border: "1px solid var(--luc-border)", borderRadius: 10, cursor: "pointer",
  },
  toggleInfo: { display: "flex", flexDirection: "column", gap: 2, flex: 1 },
  toggleLabel: { fontSize: 14, fontWeight: 600, color: "var(--luc-text)" },
  toggleDesc: { fontSize: 12, color: "var(--luc-text-muted)" },
  toggle: {
    width: 42, height: 24, borderRadius: 12, position: "relative",
    transition: "background 0.2s ease", flexShrink: 0, marginLeft: 16,
  },
  toggleKnob: {
    width: 20, height: 20, borderRadius: "50%", background: "#fff",
    position: "absolute", top: 2, transition: "transform 0.2s ease",
    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
  },
  saveRow: {
    display: "flex", alignItems: "center", gap: 16,
    paddingTop: 24, borderTop: "1px solid var(--luc-border)",
  },
  saveBtn: {
    padding: "10px 24px", background: "var(--luc-accent)", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
  saveNote: { fontSize: 12, color: "var(--luc-text-muted)" },
};
