/**
 * Staff Forgot Password — /admin-forgot-password
 *
 * Lets a staff member request a password-reset link. To avoid account
 * enumeration, the same success message is shown whether or not the email
 * belongs to a staff account. When it does, a single-use, 1-hour token is
 * stored in StaffPasswordResetToken.
 *
 * EMAIL IS STUBBED — the reset link is logged to the server console only.
 */
import crypto from "crypto";
import { json, redirect } from "@remix-run/node";
import { useActionData, useNavigation, Form, Link } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import { getStaffUserId } from "../lib/staff-session.server.js";
import { hashStaffResetToken } from "../lib/auth.server.js";

const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export const loader = async ({ request }) => {
  const staffUserId = await getStaffUserId(request);
  if (staffUserId) return redirect("/app/admin");
  return json({});
};

export const action = async ({ request }) => {
  const formData = await request.formData();
  const email = (formData.get("email") || "").toString().toLowerCase().trim();

  // Look up a staff account with this email. We always return the same
  // response regardless of the result so the endpoint can't be used to
  // enumerate which emails belong to staff.
  if (email) {
    const user = await prisma.user.findFirst({
      where: { email, isStaff: true },
      select: { id: true, email: true },
    });

    if (user) {
      // The raw token only ever appears in the reset link; the database stores
      // only its SHA-256 hash, so a DB dump can't yield working reset links.
      const rawToken = crypto.randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + TOKEN_TTL_MS);

      await prisma.staffPasswordResetToken.create({
        data: { token: hashStaffResetToken(rawToken), userId: user.id, expiresAt },
      });

      const resetUrl = `/admin-reset-password/${rawToken}`;
      // TODO: replace with real email send when provider is configured (Resend/SendGrid/SMTP)
      console.log(`[STAFF PASSWORD RESET] Token for ${email}: ${resetUrl}`);
    }
  }

  return json({ sent: true });
};

export default function AdminForgotPassword() {
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";
  const sent = actionData?.sent;

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
          <h1 style={styles.heading}>Reset your password</h1>
          <p style={styles.subheading}>
            Enter your staff email and we'll send you a reset link.
          </p>
        </div>

        {sent ? (
          <div style={styles.body}>
            <div style={styles.successBox}>
              If that email belongs to a staff account, a reset link has been sent.
            </div>
            <div style={styles.centerLink}>
              <Link to="/admin-login" style={styles.link}>← Back to sign in</Link>
            </div>
          </div>
        ) : (
          <Form method="post" style={styles.form}>
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

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? "Sending..." : "Send reset link"}
            </button>

            <div style={styles.centerLink}>
              <Link to="/admin-login" style={styles.link}>← Back to sign in</Link>
            </div>
          </Form>
        )}
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
  subheading: { fontSize: 12, color: "#6b7280", marginTop: 4, textAlign: "center" },
  form: { padding: "28px 32px" },
  body: { padding: "28px 32px" },
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
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: 4,
    padding: "12px 14px",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  centerLink: { textAlign: "center", marginTop: 16 },
  link: { fontSize: 13, color: "#6b7280", textDecoration: "none" },
};
