/**
 * Staff Management — /app/admin/staff
 *
 * Lets an existing staff member manage who has admin access:
 *   - Add a new staff account (creates a User with isStaff = true)
 *   - Revoke staff access (sets isStaff = false; cannot revoke yourself)
 *   - Reset a staff member's password directly
 *
 * Gated by requireAdmin (dedicated staff session). Nested under the
 * /app/admin layout, which already enforces the isStaff check.
 */
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import { useState, Fragment } from "react";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin.server.js";
import { hashPassword } from "../lib/auth.server.js";

const MIN_PASSWORD_LENGTH = 8;

export async function loader({ request }) {
  const admin = await requireAdmin(request);

  const staff = await prisma.user.findMany({
    where: { isStaff: true },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      status: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  return json({ staff, currentAdminId: admin.id });
}

export async function action({ request }) {
  const admin = await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  // ─── Add a new staff account ───────────────────────────────
  if (intent === "add-staff") {
    const email = (form.get("email") || "").toString().toLowerCase().trim();
    const name = (form.get("name") || "").toString().trim();
    const password = (form.get("password") || "").toString();
    const confirmPassword = (form.get("confirmPassword") || "").toString();

    if (!email || !email.includes("@")) {
      return json({ intent, error: "Please enter a valid email address." }, { status: 400 });
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      return json({ intent, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.` }, { status: 400 });
    }
    if (password !== confirmPassword) {
      return json({ intent, error: "Passwords do not match." }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return json({ intent, error: "An account with this email already exists." }, { status: 400 });
    }

    // The User model requires firstName + lastName + a unique wishlistToken.
    // "name" is optional in the form, so derive sensible name parts from it
    // (falling back to the email local-part) and mint a wishlist token.
    const fallback = email.split("@")[0];
    const parts = name ? name.split(/\s+/) : [];
    const firstName = (parts[0] || fallback).slice(0, 60);
    const lastName = parts.slice(1).join(" ").slice(0, 60);

    const passwordHash = await hashPassword(password);

    try {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          firstName,
          lastName,
          isStaff: true,
          userType: "collector",
          wishlistToken: uuidv4(),
        },
      });
    } catch (err) {
      return json({ intent, error: err.message || "Failed to create staff account." }, { status: 400 });
    }

    return json({ intent, success: `Staff account created for ${email}.` });
  }

  // ─── Revoke staff access ───────────────────────────────────
  if (intent === "revoke-staff") {
    const userId = (form.get("userId") || "").toString();
    if (!userId) {
      return json({ intent, error: "Missing staff account id." }, { status: 400 });
    }
    if (userId === admin.id) {
      return json({ intent, error: "You cannot revoke your own admin access." }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isStaff: true } });
    if (!target || !target.isStaff) {
      return json({ intent, error: "That account is not a staff member." }, { status: 400 });
    }

    await prisma.user.update({ where: { id: userId }, data: { isStaff: false } });
    return json({ intent, success: `Revoked admin access for ${target.email}.` });
  }

  // ─── Reset a staff member's password ───────────────────────
  if (intent === "reset-password") {
    const userId = (form.get("userId") || "").toString();
    const newPassword = (form.get("newPassword") || "").toString();
    const confirmPassword = (form.get("confirmPassword") || "").toString();

    if (!userId) {
      return json({ intent, error: "Missing staff account id." }, { status: 400 });
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return json({ intent, error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`, resetUserId: userId }, { status: 400 });
    }
    if (newPassword !== confirmPassword) {
      return json({ intent, error: "Passwords do not match.", resetUserId: userId }, { status: 400 });
    }

    const target = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, isStaff: true } });
    if (!target || !target.isStaff) {
      return json({ intent, error: "That account is not a staff member." }, { status: 400 });
    }

    const passwordHash = await hashPassword(newPassword);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
    return json({ intent, success: `Password reset for ${target.email}.` });
  }

  return json({ error: "Unknown action." }, { status: 400 });
}

function fullName(u) {
  const n = `${u.firstName || ""} ${u.lastName || ""}`.trim();
  return n || "—";
}

function formatDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return "—";
  }
}

export default function StaffAdmin() {
  const { staff, currentAdminId } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Which row's inline reset-password form is expanded.
  const [resetOpenId, setResetOpenId] = useState(
    actionData?.intent === "reset-password" && actionData?.error ? actionData.resetUserId : null,
  );

  return (
    <div>
      <div style={styles.pageHead}>
        <div>
          <h2 style={styles.h2}>Staff Management</h2>
          <p style={styles.sub}>Manage who can sign in to the admin panel.</p>
        </div>
      </div>

      {actionData?.success && (
        <div style={styles.successBox}>✅ {actionData.success}</div>
      )}
      {actionData?.error && (
        <div style={styles.errorBox}>⚠️ {actionData.error}</div>
      )}

      {/* ─── Current staff table ─── */}
      <div style={styles.card}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Email</th>
              <th style={styles.th}>Name</th>
              <th style={styles.th}>Created</th>
              <th style={{ ...styles.th, textAlign: "right" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {staff.map((u, i) => {
              const isSelf = u.id === currentAdminId;
              const resetOpen = resetOpenId === u.id;
              return (
                <Fragment key={u.id}>
                  <tr style={i % 2 === 1 ? styles.altRow : undefined}>
                    <td style={styles.td}>
                      <span style={styles.emailCell}>{u.email}</span>
                      {isSelf && <span style={styles.youBadge}>You</span>}
                    </td>
                    <td style={styles.td}>{fullName(u)}</td>
                    <td style={styles.td}>
                      <span style={styles.dateText}>{formatDate(u.createdAt)}</span>
                    </td>
                    <td style={{ ...styles.td, textAlign: "right" }}>
                      <button
                        type="button"
                        style={styles.secondaryBtn}
                        onClick={() => setResetOpenId(resetOpen ? null : u.id)}
                      >
                        {resetOpen ? "Cancel" : "Reset Password"}
                      </button>
                      {isSelf ? (
                        <button
                          type="button"
                          disabled
                          title="Cannot revoke your own access"
                          style={{ ...styles.dangerBtn, ...styles.disabledBtn }}
                        >
                          Revoke Access
                        </button>
                      ) : (
                        <Form
                          method="post"
                          style={{ display: "inline" }}
                          onSubmit={(e) => {
                            if (!window.confirm(`Revoke admin access for ${u.email}?`)) e.preventDefault();
                          }}
                        >
                          <input type="hidden" name="intent" value="revoke-staff" />
                          <input type="hidden" name="userId" value={u.id} />
                          <button type="submit" style={styles.dangerBtn} disabled={isSubmitting}>
                            Revoke Access
                          </button>
                        </Form>
                      )}
                    </td>
                  </tr>
                  {resetOpen && (
                    <tr style={styles.resetRow}>
                      <td style={styles.td} colSpan={4}>
                        <Form method="post" style={styles.resetForm}>
                          <input type="hidden" name="intent" value="reset-password" />
                          <input type="hidden" name="userId" value={u.id} />
                          <span style={styles.resetLabel}>New password for {u.email}:</span>
                          <input
                            type="password"
                            name="newPassword"
                            placeholder="New password"
                            minLength={MIN_PASSWORD_LENGTH}
                            required
                            style={styles.inlineInput}
                            autoComplete="new-password"
                          />
                          <input
                            type="password"
                            name="confirmPassword"
                            placeholder="Confirm password"
                            minLength={MIN_PASSWORD_LENGTH}
                            required
                            style={styles.inlineInput}
                            autoComplete="new-password"
                          />
                          <button type="submit" style={styles.primaryBtn} disabled={isSubmitting}>
                            Save Password
                          </button>
                        </Form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            {staff.length === 0 && (
              <tr>
                <td style={{ ...styles.td, textAlign: "center", color: "#999" }} colSpan={4}>
                  No staff accounts yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ─── Add staff account ─── */}
      <div style={{ ...styles.card, marginTop: 24, padding: 20 }}>
        <h3 style={styles.h3}>Add Staff Account</h3>
        <p style={styles.sub}>Creates a new user with admin access. They sign in at <code>/admin-login</code>.</p>
        <Form method="post" style={styles.addForm}>
          <input type="hidden" name="intent" value="add-staff" />
          <div style={styles.formRow}>
            <div style={styles.field}>
              <label style={styles.label}>Email</label>
              <input type="email" name="email" placeholder="staff@luciteria.com" required style={styles.input} autoComplete="off" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Name <span style={styles.optional}>(optional)</span></label>
              <input type="text" name="name" placeholder="Jane Doe" style={styles.input} autoComplete="off" />
            </div>
          </div>
          <div style={styles.formRow}>
            <div style={styles.field}>
              <label style={styles.label}>Password</label>
              <input type="password" name="password" placeholder="At least 8 characters" minLength={MIN_PASSWORD_LENGTH} required style={styles.input} autoComplete="new-password" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirm Password</label>
              <input type="password" name="confirmPassword" placeholder="Re-enter password" minLength={MIN_PASSWORD_LENGTH} required style={styles.input} autoComplete="new-password" />
            </div>
          </div>
          <button type="submit" style={{ ...styles.primaryBtn, marginTop: 4 }} disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Add Staff Account"}
          </button>
        </Form>
      </div>
    </div>
  );
}

const styles = {
  pageHead: { marginBottom: 16 },
  h2: { fontSize: 20, fontWeight: 700, color: "#1f2937", margin: 0 },
  h3: { fontSize: 16, fontWeight: 700, color: "#1f2937", margin: "0 0 4px" },
  sub: { fontSize: 13, color: "#6b7280", margin: "4px 0 0" },
  card: {
    background: "#fff",
    borderRadius: 10,
    border: "1px solid var(--luc-border, #e0e0e0)",
    overflow: "hidden",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left",
    padding: "10px 14px",
    fontWeight: 600,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--luc-text-muted, #888)",
    borderBottom: "1px solid var(--luc-border, #e0e0e0)",
    background: "#fafafa",
  },
  td: { padding: "12px 14px", borderBottom: "1px solid #f5f5f5", verticalAlign: "middle" },
  altRow: { background: "#fafafa" },
  emailCell: { fontWeight: 600, color: "#1f2937" },
  youBadge: {
    display: "inline-block",
    marginLeft: 8,
    background: "#e8f5e9",
    color: "#2e7d32",
    fontSize: 10,
    fontWeight: 600,
    padding: "1px 6px",
    borderRadius: 8,
    textTransform: "uppercase",
  },
  dateText: { fontSize: 12, color: "#666" },
  resetRow: { background: "#f9fafb" },
  resetForm: { display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" },
  resetLabel: { fontSize: 12, color: "#374151", fontWeight: 500 },
  inlineInput: {
    padding: "7px 10px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    outline: "none",
    minWidth: 160,
  },
  primaryBtn: {
    background: "#374151",
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 6,
    padding: "8px 16px",
    border: "1px solid #1f2937",
    cursor: "pointer",
  },
  secondaryBtn: {
    background: "#f0f4ff",
    color: "#2563eb",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    padding: "6px 12px",
    border: "1px solid #dbe4ff",
    cursor: "pointer",
    marginRight: 8,
  },
  dangerBtn: {
    background: "#fef2f2",
    color: "#b91c1c",
    fontSize: 12,
    fontWeight: 600,
    borderRadius: 6,
    padding: "6px 12px",
    border: "1px solid #fecaca",
    cursor: "pointer",
  },
  disabledBtn: { opacity: 0.5, cursor: "not-allowed" },
  addForm: { marginTop: 12, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 },
  formRow: { display: "flex", gap: 16, flexWrap: "wrap" },
  field: { flex: "1 1 260px", display: "flex", flexDirection: "column", gap: 6 },
  label: { fontSize: 13, color: "#374151", fontWeight: 500 },
  optional: { color: "#9ca3af", fontWeight: 400 },
  input: {
    padding: "9px 12px",
    fontSize: 13,
    border: "1px solid #d1d5db",
    borderRadius: 6,
    outline: "none",
  },
  successBox: {
    background: "#f0fdf4",
    border: "1px solid #bbf7d0",
    color: "#166534",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
  errorBox: {
    background: "#fef2f2",
    border: "1px solid #fecaca",
    color: "#991b1b",
    borderRadius: 6,
    padding: "10px 14px",
    fontSize: 13,
    marginBottom: 16,
  },
};
