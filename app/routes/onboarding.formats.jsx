/**
 * Onboarding Step 3 — Format Selection
 * 
 * Subscribers: Select primary subscription format + optional tracked formats
 * Collectors: Multi-select checkboxes for all formats they track
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import OnboardingLayout from "../components/OnboardingLayout";
import Toast from "../components/Toast";
import { getUserById, updateUser } from "../lib/auth.server";
import { requireUserId } from "../lib/session.server";

const FORMATS = [
  { id: "10mm", label: "10mm Cubes", desc: "Pocket-sized precision cubes", icon: "🔸" },
  { id: "10mm_shards", label: "10mm Box (Shards/Flakes)", desc: "10mm box with shards or flakes", icon: "🔹" },
  { id: "25.4mm", label: "25.4mm Cubes (1 inch)", desc: "Our most popular size", icon: "🔶" },
  { id: "50mm", label: "50mm Cubes", desc: "Statement pieces, museum-grade", icon: "🟧" },
  { id: "lucite", label: "Lucite Cubes", desc: "Elements embedded in crystal-clear acrylic", icon: "💎" },
  { id: "ampoules", label: "Ampoules", desc: "Sealed glass vials for reactive elements", icon: "🧪" },
];

export const loader = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");
  if (user.onboardingCompleted) return redirect("/app/cabinet");
  return json({ user });
};

export const action = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  const formData = await request.formData();

  if (user.isSubscriber) {
    const subscriptionFormat = formData.get("subscriptionFormat");
    if (!subscriptionFormat) {
      return json({ error: "Please select your subscription format." }, { status: 400 });
    }
    const trackedFormats = formData.getAll("trackedFormats");
    await updateUser(userId, {
      subscriptionFormat,
      trackedFormats: JSON.stringify(trackedFormats),
      onboardingStep: 4,
    });
  } else {
    const trackedFormats = formData.getAll("trackedFormats");
    if (trackedFormats.length === 0) {
      return json({ error: "Please select at least one format you collect." }, { status: 400 });
    }
    await updateUser(userId, {
      trackedFormats: JSON.stringify(trackedFormats),
      onboardingStep: 4,
    });
  }

  return redirect("/onboarding/collection");
};

export default function OnboardingFormats() {
  const { user } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const existingTracked = (() => {
    try { return JSON.parse(user.trackedFormats || "[]"); } catch { return []; }
  })();

  const [subFormat, setSubFormat] = useState(user.subscriptionFormat || "");
  const [trackedFormats, setTrackedFormats] = useState(new Set(existingTracked));

  const toggleTracked = (id) => {
    setTrackedFormats(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const isValid = user.isSubscriber ? !!subFormat : trackedFormats.size > 0;

  return (
    <OnboardingLayout step={3}>
      {actionData?.error && <Toast message={actionData.error} type="error" />}

      <div style={styles.header}>
        <h2 style={styles.title}>
          {user.isSubscriber ? "Your Subscription Format" : "What Do You Collect?"}
        </h2>
        <p style={styles.subtitle}>
          {user.isSubscriber
            ? "Select which format your Cube of the Month subscription delivers, plus any other formats you track."
            : "Choose all the formats you collect or want to track."}
        </p>
      </div>

      <Form method="post">
        {/* Subscriber: Primary format dropdown */}
        {user.isSubscriber && (
          <div style={styles.section}>
            <label style={styles.sectionLabel}>Subscription Format *</label>
            <select
              name="subscriptionFormat"
              value={subFormat}
              onChange={(e) => setSubFormat(e.target.value)}
              style={styles.select}
              required
            >
              <option value="">Select your subscription format...</option>
              {FORMATS.map((f) => (
                <option key={f.id} value={f.id}>{f.icon} {f.label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Format checkboxes */}
        <div style={styles.section}>
          <label style={styles.sectionLabel}>
            {user.isSubscriber ? "Also tracking (optional)" : "Formats you collect *"}
          </label>
          <div style={styles.formatGrid}>
            {FORMATS.map((f) => {
              const isChecked = trackedFormats.has(f.id);
              const isSubFormat = user.isSubscriber && subFormat === f.id;
              return (
                <label
                  key={f.id}
                  style={{
                    ...styles.formatCard,
                    ...(isChecked || isSubFormat ? styles.formatCardSelected : {}),
                    ...(isSubFormat ? { opacity: 0.6, pointerEvents: "none" } : {}),
                  }}
                >
                  <input
                    type="checkbox"
                    name="trackedFormats"
                    value={f.id}
                    checked={isChecked || isSubFormat}
                    onChange={() => !isSubFormat && toggleTracked(f.id)}
                    style={{ display: "none" }}
                  />
                  <span style={styles.formatIcon}>{f.icon}</span>
                  <span style={styles.formatLabel}>{f.label}</span>
                  <span style={styles.formatDesc}>{f.desc}</span>
                  <span style={{
                    ...styles.checkbox,
                    ...(isChecked || isSubFormat ? styles.checkboxChecked : {}),
                  }}>
                    {(isChecked || isSubFormat) ? "✓" : ""}
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        <button
          type="submit"
          disabled={!isValid || isSubmitting}
          style={{
            ...styles.submitBtn,
            opacity: !isValid || isSubmitting ? 0.5 : 1,
          }}
        >
          {isSubmitting ? "Saving..." : "Continue →"}
        </button>
      </Form>
    </OnboardingLayout>
  );
}

const styles = {
  header: { textAlign: "center", marginBottom: 28 },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    margin: 0,
  },
  subtitle: {
    fontSize: 14,
    color: "var(--luc-text-muted, #6b7280)",
    marginTop: 8,
    lineHeight: 1.5,
  },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--luc-text, #1a1a2e)",
    marginBottom: 10,
    display: "block",
  },
  select: {
    width: "100%",
    padding: "10px 14px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #e2e5ea)",
    fontSize: 14,
    color: "var(--luc-text, #1a1a2e)",
    background: "#fff",
    outline: "none",
  },
  formatGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
    gap: 10,
  },
  formatCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    padding: "16px 12px",
    borderRadius: 12,
    border: "2px solid var(--luc-border, #e2e5ea)",
    background: "#fff",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.15s",
    position: "relative",
  },
  formatCardSelected: {
    borderColor: "var(--luc-accent, #4A90E2)",
    background: "#f0f7ff",
    boxShadow: "0 0 0 3px rgba(74, 144, 226, 0.1)",
  },
  formatIcon: { fontSize: 28 },
  formatLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--luc-text, #1a1a2e)",
  },
  formatDesc: {
    fontSize: 11,
    color: "var(--luc-text-muted, #6b7280)",
    lineHeight: 1.3,
  },
  checkbox: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 20,
    height: 20,
    borderRadius: 4,
    border: "2px solid #ccc",
    fontSize: 12,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "#fff",
    fontWeight: 700,
  },
  checkboxChecked: {
    background: "var(--luc-accent, #4A90E2)",
    borderColor: "var(--luc-accent, #4A90E2)",
  },
  submitBtn: {
    width: "100%",
    padding: "14px 24px",
    borderRadius: 10,
    border: "none",
    background: "var(--luc-accent, #4A90E2)",
    color: "#fff",
    fontSize: 15,
    fontWeight: 600,
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
};
