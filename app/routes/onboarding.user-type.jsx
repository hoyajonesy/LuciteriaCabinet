/**
 * Onboarding Step 2 — User Type Selection
 * 
 * "I'm a Cube of the Month subscriber" vs "I just want to track my collection"
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import OnboardingLayout from "../components/OnboardingLayout";
import Toast from "../components/Toast";
import { getUserById, updateUser } from "../lib/auth.server";
import { requireUserId } from "../lib/session.server";

export const loader = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");
  if (user.onboardingCompleted) return redirect("/app/cabinet");
  return json({ user });
};

export const action = async ({ request }) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const userType = formData.get("userType");

  if (!userType || !["subscriber", "collector"].includes(userType)) {
    return json({ error: "Please select how you use Luciteria." }, { status: 400 });
  }

  await updateUser(userId, {
    userType,
    isSubscriber: userType === "subscriber",
    onboardingStep: 3,
  });

  // Redirect to new collection-first step 3 (log owned elements)
  return redirect("/onboarding/log-owned");
};

export default function OnboardingUserType() {
  const { user } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const [selected, setSelected] = useState(user.userType !== "collector" ? user.userType : null);

  return (
    <OnboardingLayout step={2}>
      {actionData?.error && <Toast message={actionData.error} type="error" />}

      <div style={styles.header}>
        <h2 style={styles.title}>How do you collect?</h2>
        <p style={styles.subtitle}>
          This helps us personalize your Collector Cabinet experience, {user.firstName}.
        </p>
      </div>

      <Form method="post">
        <input type="hidden" name="userType" value={selected || ""} />

        <div style={styles.options}>
          {/* Subscriber Option */}
          <button
            type="button"
            onClick={() => setSelected("subscriber")}
            style={{
              ...styles.option,
              ...(selected === "subscriber" ? styles.optionSelected : {}),
            }}
          >
            <span style={styles.optionIcon}>📬</span>
            <div style={styles.optionContent}>
              <span style={styles.optionTitle}>I'm a Cube of the Month subscriber</span>
              <span style={styles.optionDesc}>
                I receive monthly element shipments. Track my subscription, see what's coming next, and never get duplicates.
              </span>
            </div>
            <div style={{
              ...styles.radio,
              ...(selected === "subscriber" ? styles.radioSelected : {}),
            }}>
              {selected === "subscriber" && <div style={styles.radioDot} />}
            </div>
          </button>

          {/* Collector Option */}
          <button
            type="button"
            onClick={() => setSelected("collector")}
            style={{
              ...styles.option,
              ...(selected === "collector" ? styles.optionSelected : {}),
            }}
          >
            <span style={styles.optionIcon}>🗄️</span>
            <div style={styles.optionContent}>
              <span style={styles.optionTitle}>I just want to track my collection</span>
              <span style={styles.optionDesc}>
                I buy elements on my own. Help me track what I have, build a wishlist, and share it with friends.
              </span>
            </div>
            <div style={{
              ...styles.radio,
              ...(selected === "collector" ? styles.radioSelected : {}),
            }}>
              {selected === "collector" && <div style={styles.radioDot} />}
            </div>
          </button>
        </div>

        <button
          type="submit"
          disabled={!selected || isSubmitting}
          style={{
            ...styles.submitBtn,
            opacity: !selected || isSubmitting ? 0.5 : 1,
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
  options: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    marginBottom: 24,
  },
  option: {
    display: "flex",
    alignItems: "flex-start",
    gap: 14,
    padding: "18px 20px",
    borderRadius: 12,
    border: "2px solid var(--luc-border, #e2e5ea)",
    background: "#fff",
    cursor: "pointer",
    textAlign: "left",
    transition: "all 0.15s ease",
    width: "100%",
    fontFamily: "inherit",
    fontSize: "inherit",
  },
  optionSelected: {
    borderColor: "var(--luc-accent, #4A90E2)",
    background: "#f0f7ff",
    boxShadow: "0 0 0 3px rgba(74, 144, 226, 0.12)",
  },
  optionIcon: { fontSize: 32, flexShrink: 0, marginTop: 2 },
  optionContent: { flex: 1 },
  optionTitle: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--luc-text, #1a1a2e)",
    display: "block",
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 13,
    color: "var(--luc-text-muted, #6b7280)",
    lineHeight: 1.4,
    display: "block",
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: "50%",
    border: "2px solid #ccc",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: 4,
  },
  radioSelected: {
    borderColor: "var(--luc-accent, #4A90E2)",
  },
  radioDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    background: "var(--luc-accent, #4A90E2)",
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
