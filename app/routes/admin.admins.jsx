/**
 * Admin Management — /admin/admins
 * View, add, remove admin accounts.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin, createAdminUser } from "../lib/admin-session.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const admins = await prisma.adminUser.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, email: true, name: true, createdAt: true },
  });
  return json({ admins });
};

export const action = async ({ request }) => {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "add") {
    const name = formData.get("name")?.toString().trim();
    const email = formData.get("email")?.toString().trim();
    const password = formData.get("password")?.toString();

    if (!name || !email || !password) {
      return json({ error: "All fields are required." }, { status: 400 });
    }
    if (password.length < 6) {
      return json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const existing = await prisma.adminUser.findUnique({ where: { email } });
    if (existing) {
      return json({ error: "An admin with this email already exists." }, { status: 400 });
    }

    await createAdminUser(name, email, password);
    return json({ success: true, action: "added" });
  }

  if (intent === "remove") {
    const adminId = formData.get("adminId");
    if (adminId === admin.id) {
      return json({ error: "You cannot remove your own account." }, { status: 400 });
    }
    const count = await prisma.adminUser.count();
    if (count <= 1) {
      return json({ error: "Cannot remove the last admin account." }, { status: 400 });
    }
    await prisma.adminUser.delete({ where: { id: adminId } });
    return json({ success: true, action: "removed" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function AdminManagement() {
  const { admins } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [showAddModal, setShowAddModal] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(null);

  useEffect(() => {
    if (actionData?.success) {
      setShowAddModal(false);
      setConfirmRemove(null);
    }
  }, [actionData]);

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>Admin Management</h1>
          <p style={S.subtitle}>{admins.length} admin account{admins.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => setShowAddModal(true)} style={S.addBtn}>+ Add Admin</button>
      </div>

      {actionData?.success && (
        <div style={S.successToast}>
          ✅ Admin {actionData.action} successfully.
        </div>
      )}
      {actionData?.error && (
        <div style={S.errorToast}>⚠️ {actionData.error}</div>
      )}

      {/* Admin List */}
      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Name</th>
              <th style={S.th}>Email</th>
              <th style={S.th}>Created</th>
              <th style={{ ...S.th, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {admins.map((a, i) => (
              <tr key={a.id} style={i % 2 ? S.altRow : {}}>
                <td style={{ ...S.td, fontWeight: 600 }}>
                  <span style={S.avatar}>{a.name.charAt(0).toUpperCase()}</span>
                  {a.name}
                </td>
                <td style={{ ...S.td, color: "#6b7280" }}>{a.email}</td>
                <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>
                  {new Date(a.createdAt).toLocaleDateString()}
                </td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  <button
                    onClick={() => setConfirmRemove(a)}
                    style={S.removeBtn}
                  >
                    🗑️ Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Admin Modal */}
      {showAddModal && (
        <div style={S.overlay} onClick={() => setShowAddModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>➕ Add Admin</h2>
              <button onClick={() => setShowAddModal(false)} style={S.modalClose}>✕</button>
            </div>
            <Form method="post" style={S.modalBody}>
              <input type="hidden" name="intent" value="add" />

              <label style={S.label}>Full Name</label>
              <input type="text" name="name" required placeholder="Jane Doe" style={S.input} />

              <label style={S.label}>Email</label>
              <input type="email" name="email" required placeholder="jane@luciteria.com" style={S.input} />

              <label style={S.label}>Password</label>
              <input type="password" name="password" required placeholder="Min 6 characters" minLength={6} style={S.input} />

              <div style={S.infoBox}>
                ℹ️ All admins have equal permissions. Share credentials securely.
              </div>

              <div style={S.modalActions}>
                <button type="button" onClick={() => setShowAddModal(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.submitBtn} disabled={navigation.state === "submitting"}>
                  {navigation.state === "submitting" ? "Creating..." : "Create Admin"}
                </button>
              </div>
            </Form>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {confirmRemove && (
        <div style={S.overlay} onClick={() => setConfirmRemove(null)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>⚠️ Remove Admin</h2>
              <button onClick={() => setConfirmRemove(null)} style={S.modalClose}>✕</button>
            </div>
            <div style={S.modalBody}>
              <p style={{ fontSize: 14, color: "#374151", marginBottom: 16 }}>
                Are you sure you want to remove <strong>{confirmRemove.name}</strong> ({confirmRemove.email})?
                This action cannot be undone.
              </p>
              <div style={S.modalActions}>
                <button type="button" onClick={() => setConfirmRemove(null)} style={S.cancelBtn}>Cancel</button>
                <Form method="post" style={{ display: "inline" }}>
                  <input type="hidden" name="intent" value="remove" />
                  <input type="hidden" name="adminId" value={confirmRemove.id} />
                  <button type="submit" style={S.dangerBtn}>Remove Admin</button>
                </Form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  h1: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  subtitle: { fontSize: 14, color: "#6b7280", marginTop: 2 },
  addBtn: {
    padding: "8px 18px", background: "#374151", color: "#fff",
    border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600,
  },
  successToast: {
    background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6,
    padding: "10px 16px", fontSize: 13, color: "#166534", marginBottom: 16,
  },
  errorToast: {
    background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6,
    padding: "10px 16px", fontSize: 13, color: "#991b1b", marginBottom: 16,
  },
  card: {
    background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb",
    overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: {
    textAlign: "left", padding: "10px 18px", fontWeight: 600, fontSize: 11,
    textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280",
    background: "#f9fafb", borderBottom: "1px solid #e5e7eb",
  },
  td: { padding: "12px 18px", color: "#374151", borderBottom: "1px solid #f3f4f6" },
  altRow: { background: "#fafafa" },
  avatar: {
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 28, borderRadius: "50%", background: "#374151",
    color: "#fff", fontSize: 12, fontWeight: 600, marginRight: 8,
  },
  removeBtn: {
    padding: "4px 10px", background: "#fef2f2", border: "1px solid #fecaca",
    borderRadius: 4, fontSize: 11, color: "#991b1b", cursor: "pointer",
  },
  overlay: {
    position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)",
    display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
  },
  modal: {
    background: "#fff", borderRadius: 10, width: 440, maxWidth: "90vw",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
  },
  modalHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 20px", borderBottom: "1px solid #e5e7eb",
  },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 },
  modalClose: { background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer" },
  modalBody: { padding: 20 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6, marginTop: 12 },
  input: {
    width: "100%", padding: "8px 12px", border: "1px solid #d1d5db",
    borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box",
  },
  infoBox: {
    margin: "16px 0 0", padding: 12, background: "#f9fafb",
    border: "1px solid #e5e7eb", borderRadius: 4, fontSize: 12, color: "#6b7280",
  },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelBtn: {
    padding: "8px 16px", background: "#fff", border: "1px solid #d1d5db",
    borderRadius: 6, fontSize: 13, color: "#374151", cursor: "pointer",
  },
  submitBtn: {
    padding: "8px 16px", background: "#374151", border: "1px solid #1f2937",
    borderRadius: 6, fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600,
  },
  dangerBtn: {
    padding: "8px 16px", background: "#dc2626", border: "1px solid #b91c1c",
    borderRadius: 6, fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600,
  },
};
