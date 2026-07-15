/**
 * Admin Format Management — /admin/formats
 * CRUD for collection formats.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin-session.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const formats = await prisma.format.findMany({ orderBy: { displayOrder: "asc" } });
  return json({ formats });
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create") {
    const name = formData.get("name")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || "";
    const displayOrder = parseInt(formData.get("displayOrder") || "0", 10);

    if (!name) return json({ error: "Name is required." }, { status: 400 });
    const exists = await prisma.format.findUnique({ where: { name } });
    if (exists) return json({ error: "A format with this name already exists." }, { status: 400 });

    await prisma.format.create({ data: { name, description, displayOrder } });
    return json({ success: true, action: "created" });
  }

  if (intent === "update") {
    const id = formData.get("id");
    const name = formData.get("name")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || "";
    const displayOrder = parseInt(formData.get("displayOrder") || "0", 10);
    const isActive = formData.get("isActive") === "true";

    if (!name) return json({ error: "Name is required." }, { status: 400 });

    await prisma.format.update({
      where: { id },
      data: { name, description, displayOrder, isActive },
    });
    return json({ success: true, action: "updated" });
  }

  if (intent === "delete") {
    const id = formData.get("id");
    await prisma.format.delete({ where: { id } });
    return json({ success: true, action: "deleted" });
  }

  if (intent === "toggle") {
    const id = formData.get("id");
    const current = await prisma.format.findUnique({ where: { id } });
    if (current) {
      await prisma.format.update({
        where: { id },
        data: { isActive: !current.isActive },
      });
    }
    return json({ success: true, action: "toggled" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function AdminFormats() {
  const { formats } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [showModal, setShowModal] = useState(false);
  const [editFormat, setEditFormat] = useState(null);

  useEffect(() => {
    if (actionData?.success) { setShowModal(false); setEditFormat(null); }
  }, [actionData]);

  const openEdit = (f) => { setEditFormat(f); setShowModal(true); };
  const openCreate = () => { setEditFormat(null); setShowModal(true); };

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>🧊 Format Management</h1>
          <p style={S.subtitle}>{formats.length} format{formats.length !== 1 ? "s" : ""} configured</p>
        </div>
        <button onClick={openCreate} style={S.addBtn}>+ Add Format</button>
      </div>

      {actionData?.success && <div style={S.toast}>✅ Format {actionData.action} successfully.</div>}
      {actionData?.error && <div style={S.errorToast}>⚠️ {actionData.error}</div>}

      <div style={S.card}>
        <table style={S.table}>
          <thead>
            <tr>
              <th style={S.th}>Order</th>
              <th style={S.th}>Name</th>
              <th style={S.th}>Description</th>
              <th style={S.th}>Status</th>
              <th style={{ ...S.th, textAlign: "center" }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {formats.map((f, i) => (
              <tr key={f.id} style={i % 2 ? S.altRow : {}}>
                <td style={{ ...S.td, fontWeight: 600, color: "#6b7280", width: 60 }}>{f.displayOrder}</td>
                <td style={{ ...S.td, fontWeight: 600 }}>{f.name}</td>
                <td style={{ ...S.td, color: "#6b7280", maxWidth: 300 }}>{f.description || "—"}</td>
                <td style={S.td}>
                  <Form method="post" style={{ display: "inline" }}>
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" style={{
                      ...S.statusBtn,
                      background: f.isActive ? "#f0fdf4" : "#fef2f2",
                      color: f.isActive ? "#166534" : "#991b1b",
                      border: `1px solid ${f.isActive ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                      {f.isActive ? "✅ Active" : "⛔ Inactive"}
                    </button>
                  </Form>
                </td>
                <td style={{ ...S.td, textAlign: "center" }}>
                  <button onClick={() => openEdit(f)} style={S.editBtn}>✏️ Edit</button>
                  <Form method="post" style={{ display: "inline", marginLeft: 6 }}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="id" value={f.id} />
                    <button type="submit" style={S.deleteBtn} onClick={e => {
                      if (!confirm("Delete this format?")) e.preventDefault();
                    }}>🗑️</button>
                  </Form>
                </td>
              </tr>
            ))}
            {formats.length === 0 && (
              <tr><td colSpan={5} style={S.empty}>No formats configured. Click "Add Format" to create one.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div style={S.overlay} onClick={() => setShowModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>{editFormat ? "✏️ Edit Format" : "➕ Add Format"}</h2>
              <button onClick={() => setShowModal(false)} style={S.modalClose}>✕</button>
            </div>
            <Form method="post" style={S.modalBody}>
              <input type="hidden" name="intent" value={editFormat ? "update" : "create"} />
              {editFormat && <input type="hidden" name="id" value={editFormat.id} />}
              {editFormat && <input type="hidden" name="isActive" value={editFormat.isActive ? "true" : "false"} />}

              <label style={S.label}>Format Name</label>
              <input type="text" name="name" required defaultValue={editFormat?.name || ""} placeholder="e.g. Lucite Cube" style={S.input} />

              <label style={S.label}>Description</label>
              <textarea name="description" rows={2} defaultValue={editFormat?.description || ""} placeholder="Brief description..." style={S.textarea} />

              <label style={S.label}>Display Order</label>
              <input type="number" name="displayOrder" defaultValue={editFormat?.displayOrder || 0} style={S.input} />

              <div style={S.modalActions}>
                <button type="button" onClick={() => setShowModal(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.submitBtn} disabled={navigation.state === "submitting"}>
                  {editFormat ? "Save Changes" : "Create Format"}
                </button>
              </div>
            </Form>
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
  addBtn: { padding: "8px 18px", background: "#374151", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer", fontWeight: 600 },
  toast: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#166534", marginBottom: 16 },
  errorToast: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#991b1b", marginBottom: 16 },
  card: { background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "10px 18px", color: "#374151", borderBottom: "1px solid #f3f4f6" },
  altRow: { background: "#fafafa" },
  statusBtn: { padding: "3px 10px", borderRadius: 12, fontSize: 11, fontWeight: 600, cursor: "pointer" },
  editBtn: { padding: "4px 8px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "#4338ca" },
  deleteBtn: { padding: "4px 8px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "#991b1b" },
  empty: { padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 10, width: 440, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 },
  modalClose: { background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer" },
  modalBody: { padding: 20 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelBtn: { padding: "8px 16px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, color: "#374151", cursor: "pointer" },
  submitBtn: { padding: "8px 16px", background: "#374151", border: "1px solid #1f2937", borderRadius: 6, fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600 },
};
