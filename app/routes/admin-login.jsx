/**
 * Staff Login — /admin-login
 *
 * Dedicated login for the /app/admin/* panel. Authenticates against the
 * User table and requires User.isStaff, then sets the SEPARATE staff session
 * cookie (`__luc_staff_session`). This is intentionally distinct from the
 * consumer storefront login (/onboarding/welcome) so consumers can never
 * reach the admin panel.
 */
import { json, redirect } from "@remix-run/node";
import { useActionData, Form, useNavigation, Link } from "@remix-run/react";
import {
  authenticateStaff,
  createStaffSession,
  getStaffUserId,
} from "../lib/staff-session.server.js";

export const loader = async ({ request }) => {
  const staffUserId = await getStaffUserId(request);
  if (staffUserId) return redirect("/app/admin");
  return json({});
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const email = formData.get("email")?.toString().trim();
  const password = formData.get("password")?.toString();

  if (!email || !password) {
    return json({ error: "Email and password are required." }, { status: 400 });
  }

  const { user, error } = await authenticateStaff(email, password);
  if (error || !user) {
    return json({ error: error || "Invalid email or password." }, { status: 401 });
  }

  return createStaffSession(user.id, "/app/admin");
};

export default function StaffLogin() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  return (
    <div style={styles.page}>
      <div style={styles.card}>
        <div style={styles.logoSection}>
          <div style={styles.logoWrap}>
            <div style={styles.logoIcon}>🧊</div>
            <div>
              <div style={styles.logoTitle}>Luciteria</div>
              <div style={styles.logoSub}>Collector Cabinet</div>
            </div>
          </div>
          <h1 style={styles.heading}>Staff Sign In</h1>
          <p style={styles.subheading}>Admin access for Luciteria staff only.</p>
        </div>

        <Form method="post" style={styles.form}>
          {actionData?.error && (
            <div style={styles.errorBox}>
              <span>⚠️</span> {actionData.error}
            </div>
          )}

          <label style={styles.label}>Email</label>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>📧</span>
            <input
              type="email"
              name="email"
              placeholder="you@luciteria.com"
              required
              style={styles.input}
              autoComplete="email"
            />
          </div>

          <label style={styles.label}>Password</label>
          <div style={styles.inputWrap}>
            <span style={styles.inputIcon}>🔒</span>
            <input
              type="password"
              name="password"
              placeholder="••••••••••"
              required
              style={styles.input}
              autoComplete="current-password"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>

          <div style={styles.forgotWrap}>
            <Link to="/admin-forgot-password" style={styles.forgotLink}>
              Forgot your password?
            </Link>
          </div>
        </Form>

        <div style={styles.footer}>
          <div style={styles.infoBox}>
            <span>ℹ️</span>
            <span>
              This is the staff admin panel. Customers sign in from the
              storefront, not here.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#f3f4f6",
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  card: {
    width: 420,
    background: "#fff",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
  },
  logoSection: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "36px 32px 24px",
    borderBottom: "1px solid #f3f4f6",
  },
  logoWrap: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16 },
  logoIcon: {
    width: 40,
    height: 40,
    background: "#e5e7eb",
    border: "1px solid #9ca3af",
    borderRadius: 6,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 18,
  },
  logoTitle: { fontSize: 16, fontWeight: 600, color: "#1f2937", lineHeight: 1.2 },
  logoSub: { fontSize: 11, color: "#9ca3af", lineHeight: 1.2 },
  heading: { fontSize: 18, fontWeight: 600, color: "#1f2937", margin: 0 },
  subheading: { fontSize: 12, color: "#6b7280", marginTop: 4 },
  form: { padding: "28px 32px" },
  label: {
    display: "block",
    fontSize: 14,
    color: "#374151",
    marginBottom: 6,
    fontWeight: 500,
  },
  inputWrap: {
    display: "flex",
    alignItems: "center",
    border: "1px solid #d1d5db",
    borderRadius: 4,
    overflow: "hidden",
    marginBottom: 16,
  },
  inputIcon: { padding: "0 12px", fontSize: 14, color: "#9ca3af" },
  input: {
    flex: 1,
    padding: "10px 12px 10px 0",
    fontSize: 14,
    color: "#374151",
    border: "none",
    outline: "none",
    background: "transparent",
  },
  submitBtn: {
    width: "100%",
    background: "#374151",
    color: "#fff",
    fontSize: 14,
    fontWeight: 500,
    borderRadius: 4,
    padding: "10px 0",
    border: "1px solid #1f2937",
    cursor: "pointer",
    marginTop: 4,
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    background: "#fef2f2",
    border: "1px solid #fecaca",
    borderRadius: 4,
    padding: "8px 12px",
    fontSize: 13,
    color: "#991b1b",
    marginBottom: 16,
  },
  forgotWrap: { textAlign: "center", marginTop: 14 },
  forgotLink: { fontSize: 12, color: "#6b7280", textDecoration: "none" },
  footer: { padding: "0 32px 28px" },
  infoBox: {
    display: "flex",
    alignItems: "flex-start",
    gap: 8,
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    borderRadius: 4,
    padding: 12,
    fontSize: 12,
    color: "#6b7280",
  },
};
