/**
 * Admin Milestone Management — /admin/milestones
 * Manage milestone type definitions, view award statistics and history.
 * NOTE: Milestones are now awarded AUTOMATICALLY via scheduled task — no manual awarding needed.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin-session.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);

  // Fetch milestone definitions with award counts
  const milestones = await prisma.milestoneDefinition.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { awards: true }
      }
    }
  });

  // Fetch recent 50 awards
  const recentAwards = await prisma.userMilestoneAward.findMany({
    orderBy: { awardedAt: "desc" },
    take: 50,
    include: {
      user: { select: { firstName: true, lastName: true, email: true } },
      milestone: { select: { name: true, icon: true, category: true } },
    },
  });

  return json({ milestones, recentAwards });
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create_milestone") {
    const name = formData.get("name")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || "";
    const category = formData.get("category") || "collection";
    const icon = formData.get("icon") || "🏆";

    if (!name) return json({ error: "Milestone name is required." }, { status: 400 });

    const exists = await prisma.milestoneDefinition.findUnique({ where: { name } });
    if (exists) return json({ error: "A milestone with this name already exists." }, { status: 400 });

    await prisma.milestoneDefinition.create({ data: { name, description, category, icon } });
    return json({ success: true, action: "milestone_created" });
  }

  if (intent === "delete_milestone") {
    const id = formData.get("id");
    // Delete all awards for this milestone first
    await prisma.userMilestoneAward.deleteMany({ where: { milestoneId: id } });
    // Then delete the milestone definition
    await prisma.milestoneDefinition.delete({ where: { id } });
    return json({ success: true, action: "milestone_deleted" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function AdminMilestones() {
  const { milestones, recentAwards } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [showCreateModal, setShowCreateModal] = useState(false);

  useEffect(() => {
    if (actionData?.success) {
      setShowCreateModal(false);
    }
  }, [actionData]);

  return (
    <div>
      <h1 style={S.h1}>🏆 Milestone Management</h1>
      <p style={S.subtitle}>Manage milestone type definitions and view award statistics. Milestones are automatically awarded via scheduled task.</p>

      {actionData?.success && actionData.action === "milestone_created" && (
        <div style={S.toast}>✅ Milestone type created successfully.</div>
      )}
      {actionData?.success && actionData.action === "milestone_deleted" && (
        <div style={S.toast}>✅ Milestone type deleted.</div>
      )}
      {actionData?.error && <div style={S.errorToast}>⚠️ {actionData.error}</div>}

      {/* Milestone Types with Statistics */}
      <div style={S.card}>
        <div style={S.cardHeader}>
          <h3 style={S.cardTitle}>📋 Milestone Types</h3>
          <button onClick={() => setShowCreateModal(true)} style={S.addBtn}>+ Add Milestone Type</button>
        </div>
        <div style={{ padding: 0 }}>
          {milestones.length === 0 ? (
            <div style={S.empty}>No milestones defined yet. Click "Add Milestone Type" to create one.</div>
          ) : (
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>Icon</th>
                  <th style={S.th}>Name</th>
                  <th style={S.th}>Description</th>
                  <th style={S.th}>Category</th>
                  <th style={{ ...S.th, textAlign: "center" }}>Users Earned</th>
                  <th style={{ ...S.th, textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {milestones.map((m, i) => (
                  <tr key={m.id} style={i % 2 ? S.altRow : {}}>
                    <td style={{ ...S.td, fontSize: 20 }}>{m.icon}</td>
                    <td style={{ ...S.td, fontWeight: 600 }}>{m.name}</td>
                    <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>{m.description || "—"}</td>
                    <td style={S.td}>
                      <span style={S.categoryBadge}>{m.category}</span>
                    </td>
                    <td style={{ ...S.td, textAlign: "center", fontWeight: 700, color: "#2563eb" }}>
                      {m._count.awards}
                    </td>
                    <td style={{ ...S.td, textAlign: "center" }}>
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="delete_milestone" />
                        <input type="hidden" name="id" value={m.id} />
                        <button type="submit" style={S.delBtn} onClick={e => {
                          if (!confirm(`Delete "${m.name}"? This will remove all ${m._count.awards} award(s).`)) e.preventDefault();
                        }}>🗑️ Delete</button>
                      </Form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Award History (Last 50) */}
      <div style={{ ...S.card, marginTop: 24 }}>
        <div style={S.cardHeader}>
          <h3 style={S.cardTitle}>📜 Recent Milestone Awards (Last 50)</h3>
          <span style={S.badgeCount}>{recentAwards.length} awards</span>
        </div>
        {recentAwards.length === 0 ? (
          <div style={S.empty}>No milestones awarded yet.</div>
        ) : (
          <div style={{ padding: 0, maxHeight: 600, overflowY: "auto" }}>
            <table style={S.table}>
              <thead>
                <tr>
                  <th style={S.th}>User</th>
                  <th style={S.th}>Email</th>
                  <th style={S.th}>Milestone</th>
                  <th style={S.th}>Category</th>
                  <th style={S.th}>Awarded By</th>
                  <th style={S.th}>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentAwards.map((a, i) => (
                  <tr key={a.id} style={i % 2 ? S.altRow : {}}>
                    <td style={{ ...S.td, fontWeight: 600 }}>
                      {a.user.firstName} {a.user.lastName}
                    </td>
                    <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>{a.user.email}</td>
                    <td style={S.td}>
                      {a.milestone.icon} {a.milestone.name}
                    </td>
                    <td style={S.td}>
                      <span style={S.categoryBadge}>{a.milestone.category}</span>
                    </td>
                    <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>{a.awardedBy}</td>
                    <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>
                      {new Date(a.awardedAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create Milestone Modal */}
      {showCreateModal && (
        <div style={S.overlay} onClick={() => setShowCreateModal(false)}>
          <div style={S.modal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>➕ Create Milestone Type</h2>
              <button onClick={() => setShowCreateModal(false)} style={S.modalClose}>✕</button>
            </div>
            <Form method="post" style={S.modalBody} onSubmit={() => setShowCreateModal(false)}>
              <input type="hidden" name="intent" value="create_milestone" />

              <label style={S.label}>Name *</label>
              <input type="text" name="name" required placeholder="e.g. Noble Gases Complete" style={S.input} />

              <label style={S.label}>Description</label>
              <textarea name="description" rows={3} placeholder="Achievement description..." style={S.textarea} />

              <label style={S.label}>Category *</label>
              <select name="category" style={S.selectSingle}>
                <option value="collection">Collection</option>
                <option value="format">Format</option>
                <option value="engagement">Engagement</option>
              </select>

              <label style={S.label}>Icon (emoji) *</label>
              <input type="text" name="icon" defaultValue="🏆" style={{ ...S.input, width: 80 }} maxLength={4} />

              <div style={S.modalActions}>
                <button type="button" onClick={() => setShowCreateModal(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.submitBtn} disabled={navigation.state === "submitting"}>
                  {navigation.state === "submitting" ? "Creating..." : "Create"}
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
  h1: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  toast: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#166534", marginBottom: 16 },
  errorToast: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#991b1b", marginBottom: 16 },
  card: { background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" },
  cardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", borderBottom: "1px solid #e5e7eb", background: "#fafafa" },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
  addBtn: { padding: "6px 14px", background: "#2563eb", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 500, cursor: "pointer" },
  badgeCount: { fontSize: 12, padding: "4px 10px", background: "#eff6ff", color: "#2563eb", borderRadius: 12, fontWeight: 600 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" },
  selectSingle: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, background: "#fff", boxSizing: "border-box" },
  categoryBadge: { fontSize: 10, padding: "3px 10px", borderRadius: 12, background: "#f3f4f6", color: "#6b7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.3px" },
  delBtn: { padding: "4px 12px", background: "#fef2f2", color: "#dc2626", border: "1px solid #fecaca", borderRadius: 4, fontSize: 12, cursor: "pointer", fontWeight: 500 },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "12px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb", position: "sticky", top: 0 },
  td: { padding: "12px 18px", color: "#374151", borderBottom: "1px solid #f3f4f6" },
  altRow: { background: "#fafafa" },
  empty: { padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 13 },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  modal: { background: "#fff", borderRadius: 10, width: 480, maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 },
  modalClose: { background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer" },
  modalBody: { padding: 20 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 16 },
  cancelBtn: { padding: "8px 16px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, color: "#374151", cursor: "pointer" },
  submitBtn: { padding: "8px 16px", background: "#2563eb", border: "1px solid #2563eb", borderRadius: 6, fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600 },
};
