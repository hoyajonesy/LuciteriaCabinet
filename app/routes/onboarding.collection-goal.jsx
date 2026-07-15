/**
 * Onboarding Step 2 of 3 — What brings you to Collector Cabinet?
 *
 * Captures the collector's motivation(s) as a personalization signal.
 * Matches the onboarding-motivation wireframe exactly: 5 motivation cards
 * plus a dashed "Select one or more" placeholder, multi-select, neutral
 * styling, "Step 2 of 3" indicator, Back + Continue.
 *
 * Selected motivations are stored on User.primaryMotivation as a JSON array.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation, Link } from "@remix-run/react";
import { useState } from "react";
import { getUserId } from "../lib/session.server";
import { getUserById, updateUser } from "../lib/auth.server";

const MOTIVATION_OPTIONS = [
  {
    id: "inventory_management",
    icon: "📦",
    title: "Inventory Management",
    description: "Keep track of what's already in my collection.",
  },
  {
    id: "social_sharing",
    icon: "🔗",
    title: "Social Sharing",
    description: "Share my collection easily with friends.",
  },
  {
    id: "acquisition_planning",
    icon: "🛒",
    title: "Acquisition Planning",
    description: "Add missing items to my collection.",
  },
  {
    id: "investment_tracking",
    icon: "📈",
    title: "Investment Tracking",
    description: "Track what I've invested in my collection.",
  },
  {
    id: "just_exploring",
    icon: "🔍",
    title: "Just Exploring",
    description: "No specific goal yet — browsing around.",
  },
];

const VALID_IDS = new Set(MOTIVATION_OPTIONS.map((m) => m.id));

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");
  if (user.onboardingCompleted) return redirect("/app/cabinet");

  // Pre-select any previously chosen motivations (resume support).
  let selected = [];
  if (user.primaryMotivation) {
    try {
      const parsed = JSON.parse(user.primaryMotivation);
      if (Array.isArray(parsed)) selected = parsed.filter((id) => VALID_IDS.has(id));
      else if (VALID_IDS.has(user.primaryMotivation)) selected = [user.primaryMotivation];
    } catch {
      if (VALID_IDS.has(user.primaryMotivation)) selected = [user.primaryMotivation];
    }
  }

  return json({ selected });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const formData = await request.formData();
  const raw = formData.get("motivations") || "";
  const chosen = raw.split(",").map((s) => s.trim()).filter((id) => VALID_IDS.has(id));

  await updateUser(userId, {
    onboardingStep: 3,
    primaryMotivation: chosen.length ? JSON.stringify(chosen) : null,
  });

  return redirect("/onboarding/log-owned");
};

export default function MotivationStep() {
  const { selected: initialSelected } = useLoaderData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [selected, setSelected] = useState(() => new Set(initialSelected || []));

  const toggle = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectedList = Array.from(selected);

  return (
    <div style={styles.page}>
      <section style={styles.card}>
        {/* Step indicator */}
        <div style={styles.stepHeader}>
          <span style={styles.stepBadge}>Step 2 of 3</span>
          <div style={styles.bars}>
            <span style={{ ...styles.bar, ...styles.barOn }} />
            <span style={{ ...styles.bar, ...styles.barOn }} />
            <span style={styles.bar} />
          </div>
        </div>

        <h1 style={styles.title}>What brings you to Collector Cabinet?</h1>
        <p style={styles.subtitle}>
          Choose all that apply — we'll personalize your experience.
        </p>

        {/* Motivation cards grid */}
        <div style={styles.grid}>
          {MOTIVATION_OPTIONS.map((opt) => {
            const isSelected = selected.has(opt.id);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => toggle(opt.id)}
                style={{
                  ...styles.optionCard,
                  ...(isSelected ? styles.optionSelected : {}),
                }}
              >
                <span
                  style={{
                    ...styles.check,
                    ...(isSelected ? styles.checkOn : {}),
                  }}
                >
                  {isSelected ? "✓" : ""}
                </span>
                <span style={styles.iconTile}>{opt.icon}</span>
                <span style={styles.optionTitle}>{opt.title}</span>
                <span style={styles.optionDesc}>{opt.description}</span>
              </button>
            );
          })}

          {/* Dashed placeholder cell */}
          <div style={styles.placeholderCell}>Select one or more</div>
        </div>

        {/* Footer: Back + Continue */}
        <Form method="post" style={styles.footer}>
          <input type="hidden" name="motivations" value={selectedList.join(",")} />
          <Link to="/onboarding/welcome" style={styles.backLink}>
            ← Back
          </Link>
          <button type="submit" disabled={isSubmitting} style={styles.continueBtn}>
            {isSubmitting ? "Saving..." : "Continue →"}
          </button>
        </Form>
      </section>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#F5F5F5",
    padding: "48px 24px",
    fontFamily: "inherit",
  },
  card: {
    width: "100%",
    maxWidth: 860,
    background: "#fff",
    border: "1px solid #DFDFDF",
    borderRadius: 20,
    padding: 40,
  },
  stepHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  stepBadge: {
    display: "inline-block",
    fontSize: 13,
    color: "#6b7280",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    padding: "4px 12px",
    background: "#f9fafb",
  },
  bars: { display: "flex", gap: 4 },
  bar: { width: 32, height: 6, borderRadius: 4, background: "#d1d5db" },
  barOn: { background: "#5781D8" },
  title: { fontSize: 28, fontWeight: 500, color: "#0D0D0D", margin: "0 0 8px", fontFamily: "'DM Sans', sans-serif" },
  subtitle: { fontSize: 16, color: "#6b7280", margin: "0 0 32px" },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 16,
    marginBottom: 32,
  },
  optionCard: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 4,
    padding: 20,
    border: "1px solid #DFDFDF",
    borderRadius: 10,
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s",
    fontFamily: "inherit",
  },
  optionSelected: {
    border: "2px solid #5781D8",
    background: "#E1EDF5",
    padding: 19,
  },
  check: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 20,
    height: 20,
    borderRadius: "50%",
    border: "1px solid #d1d5db",
    background: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    color: "#fff",
  },
  checkOn: { background: "#5781D8", borderColor: "#5781D8" },
  iconTile: {
    width: 48,
    height: 48,
    borderRadius: 6,
    background: "#e5e7eb",
    border: "1px solid #d1d5db",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 22,
    marginBottom: 12,
  },
  optionTitle: { fontSize: 16, fontWeight: 600, color: "#1f2937", marginBottom: 4 },
  optionDesc: { fontSize: 14, color: "#6b7280", lineHeight: 1.4 },
  placeholderCell: {
    border: "1px dashed #d1d5db",
    borderRadius: 6,
    padding: 20,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 14,
    color: "#9ca3af",
  },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderTop: "1px solid #e5e7eb",
    paddingTop: 24,
  },
  backLink: {
    fontSize: 14,
    color: "#6b7280",
    textDecoration: "none",
  },
  continueBtn: {
    background: "#5781D8",
    color: "#fff",
    fontSize: 16,
    fontWeight: 400,
    border: "none",
    borderRadius: 10,
    padding: "14px 32px",
    cursor: "pointer",
    fontFamily: "inherit",
  },
};
