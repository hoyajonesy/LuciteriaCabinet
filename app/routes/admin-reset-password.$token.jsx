/**
 * Staff Reset Password — /admin-reset-password/:token
 *
 * Consumes a single-use StaffPasswordResetToken. The loader validates that the
 * token exists, is unused, and unexpired (rendering an inline error otherwise).
 * The action re-validates (guarding against replay), sets the new password,
 * marks the token used, and redirects to the staff login.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form, Link } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import { hashPassword, hashStaffResetToken } from "../lib/auth.server.js";

const MIN_PASSWORD_LENGTH = 8;

async function findValidToken(rawToken) {
  if (!rawToken) return null;
  // The DB stores only the SHA-256 hash of the token, so hash the raw value
  // from the URL before looking it up.
  return prisma.staffPasswordResetToken.findFirst({
    where: { token: hashStaffResetToken(rawToken), usedAt: null, expiresAt: { gt: new Date() } },
    include: { user: { select: { id: true, email: true } } },
  });
}

export const loader = async ({ params }) => {
  const record = await findValidToken(params.token);
  if (!record || !record.user) {
    return json({ valid: false }, { status: 400 });
  }
  return json({ valid: true, email: record.user.email });
};

export const action = async ({ request, params }) => {
  const record = await findValidToken(params.token);
  if (!record || !record.user) {
    return json({ valid: false, error: "This reset link is invalid or has expired." }, { status: 400 });
  }

  const formData = await request.formData();
  const newPassword = (formData.get("newPassword") || "").toString();
  const confirmPassword = (formData.get("confirmPassword") || "").toString();

  if (newPassword.length < MIN_PASSWORD_LENGTH) {
    return json({ valid: true, email: record.user.email, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
  }
  if (newPassword !== confirmPassword) {
    return json({ valid: true, email: record.user.email, error: "Passwords do not match." }, { status: 400 });
  }

  const passwordHash = await hashPassword(newPassword);

  await prisma.$transaction([
    prisma.user.update({ where: { id: record.user.id }, data: { passwordHash } }),
    prisma.staffPasswordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
  ]);

  return redirect("/admin-login");
};

export default function AdminResetPassword() {
  const { valid, email } = useLoaderData();
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
          <h1 style={styles.heading}>Reset your password</h1>
          {valid && email && <p style={styles.subheading}>for {email}</p>}
        </div>

        {!valid ? (
          <div style={styles.body}>
            <div style={styles.errorBox}>
              This reset link is invalid or has expired. Please request a new one.
            </div>
            <div style={styles.centerLink}>
              <Link to="/admin-forgot-password" style={styles.link}>Request a new link</Link>
            </div>
          </div>
        ) : (
          <Form method="post" style={styles.form}>
            {actionData?.error && (
              <div style={styles.errorBox}>⚠️ {actionData.error}</div>
            )}

            <label style={styles.label}>New password</label>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔒</span>
              <input
                type="password"
                name="newPassword"
                placeholder="At least 8 characters"
                minLength={MIN_PASSWORD_LENGTH}
                required
                style={styles.input}
                autoComplete="new-password"
              />
            </div>

            <label style={styles.label}>Confirm new password</label>
            <div style={styles.inputWrap}>
              <span style={styles.inputIcon}>🔒</span>
              <input
                type="password"
                name="confirmPassword"
                placeholder="Re-enter password"
                minLength={MIN_PASSWORD_LENGTH}
                required
                style={styles.input}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              style={{ ...styles.submitBtn, opacity: isSubmitting ? 0.7 : 1 }}
            >
              {isSubmitting ? "Saving..." : "Set new password"}
            </button>
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
  subheading: { fontSize: 12, color: "#6b7280", marginTop: 4 },
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
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 4,
    padding: "12px 14px",
    fontSize: 13,
    marginBottom: 16,
    textAlign: "center",
  },
  centerLink: { textAlign: "center", marginTop: 16 },
  link: { fontSize: 13, color: "#6b7280", textDecoration: "none" },
};
