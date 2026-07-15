/**
 * Admin Set Builder — /admin/sets
 * Create/edit curated element recommendation sets with interactive periodic table.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation, useRevalidator } from "@remix-run/react";
import { useState, useEffect } from "react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin-session.server.js";
import { ELEMENTS_118 } from "../data/elements.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  const sets = await prisma.collectionSet.findMany({
    orderBy: { createdAt: "desc" },
    include: { elements: true },
  });
  return json({ sets, allElements: ELEMENTS_118 });
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "create" || intent === "update") {
    const name = formData.get("name")?.toString().trim();
    const description = formData.get("description")?.toString().trim() || "";
    const tier = formData.get("tier") || "Free";
    const setType = formData.get("setType") || "Starter";
    const elementsJson = formData.get("elements") || "[]";

    if (!name) return json({ error: "Set name is required." }, { status: 400 });

    let elements;
    try { elements = JSON.parse(elementsJson); }
    catch { return json({ error: "Invalid elements data." }, { status: 400 }); }

    if (elements.length === 0) {
      return json({ error: "Select at least one element." }, { status: 400 });
    }

    if (intent === "create") {
      const set = await prisma.collectionSet.create({
        data: {
          name, description, tier, setType,
          elements: {
            create: elements.map(e => ({
              elementSymbol: e.sym,
              atomicNumber: e.z,
            })),
          },
        },
      });
      return json({ success: true, action: "created" });
    }

    if (intent === "update") {
      const id = formData.get("id");
      // Delete old elements and recreate
      await prisma.collectionSetElement.deleteMany({ where: { setId: id } });
      await prisma.collectionSet.update({
        where: { id },
        data: {
          name, description, tier, setType,
          elements: {
            create: elements.map(e => ({
              elementSymbol: e.sym,
              atomicNumber: e.z,
            })),
          },
        },
      });
      return json({ success: true, action: "updated" });
    }
  }

  if (intent === "delete") {
    const id = formData.get("id");
    await prisma.collectionSet.delete({ where: { id } });
    return json({ success: true, action: "deleted" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

// Mini periodic table for set builder
function MiniPeriodicTable({ allElements, selected, onToggle }) {
  const maxRow = Math.max(...allElements.map(e => e.row));
  const maxCol = 18;

  return (
    <div style={{ overflowX: "auto", marginTop: 8 }}>
      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${maxCol}, 38px)`,
        gap: 2,
        padding: 4,
      }}>
        {allElements.map(el => {
          const isSel = selected.some(s => s.sym === el.sym);
          return (
            <div
              key={el.sym}
              onClick={() => onToggle(el)}
              title={`${el.z} ${el.name}`}
              style={{
                gridRow: el.row,
                gridColumn: el.col,
                width: 36,
                height: 36,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: 4,
                cursor: "pointer",
                fontSize: 11,
                fontWeight: 700,
                border: isSel ? "2px solid #2563eb" : "1px solid #d1d5db",
                background: isSel ? "#dbeafe" : "#fff",
                color: isSel ? "#1e40af" : "#374151",
                transition: "all 0.1s",
                userSelect: "none",
              }}
            >
              <span style={{ fontSize: 7, color: "#9ca3af" }}>{el.z}</span>
              <span>{el.sym}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminSets() {
  const { sets, allElements } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const revalidator = useRevalidator();
  const [showBuilder, setShowBuilder] = useState(false);
  const [editSet, setEditSet] = useState(null);

  // Builder state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [tier, setTier] = useState("Free");
  const [setType, setSetType] = useState("Starter");
  const [selected, setSelected] = useState([]);

  useEffect(() => {
    if (actionData?.success) {
      setShowBuilder(false);
      setEditSet(null);
      setName("");
      setDescription("");
      setTier("Free");
      setSetType("Starter");
      setSelected([]);
      // Force revalidation to refresh the list
      revalidator.revalidate();
    }
  }, [actionData]);

  const openCreate = () => {
    setEditSet(null);
    setName(""); setDescription(""); setTier("Free"); setSetType("Starter"); setSelected([]);
    setShowBuilder(true);
  };

  const openEdit = (s) => {
    setEditSet(s);
    setName(s.name);
    setDescription(s.description);
    setTier(s.tier);
    setSetType(s.setType);
    setSelected(s.elements.map(e => ({ sym: e.elementSymbol, z: e.atomicNumber })));
    setShowBuilder(true);
  };

  const toggleElement = (el) => {
    setSelected(prev => {
      const exists = prev.find(s => s.sym === el.sym);
      if (exists) return prev.filter(s => s.sym !== el.sym);
      return [...prev, { sym: el.sym, z: el.z }];
    });
  };

  return (
    <div>
      <div style={S.header}>
        <div>
          <h1 style={S.h1}>📦 Set Builder</h1>
          <p style={S.subtitle}>Create curated element recommendation sets.</p>
        </div>
        <button onClick={openCreate} style={S.addBtn}>+ Create Set</button>
      </div>

      {actionData?.success && <div style={S.toast}>✅ Set {actionData.action} successfully.</div>}
      {actionData?.error && <div style={S.errorToast}>⚠️ {actionData.error}</div>}

      {/* Set List */}
      <div style={S.setGrid}>
        {sets.map(s => (
          <div key={s.id} style={S.setCard}>
            <div style={S.setCardHeader}>
              <h3 style={S.setName}>{s.name}</h3>
              <span style={S.setTypeBadge}>{s.setType}</span>
            </div>
            <p style={S.setDesc}>{s.description || "No description"}</p>
            <div style={S.setMeta}>
              <span style={S.tierTag}>🏷️ {s.tier}</span>
              <span style={S.countTag}>🔬 {s.elements.length} elements</span>
            </div>
            <div style={S.setElements}>
              {s.elements.slice(0, 12).map(e => (
                <span key={e.elementSymbol} style={S.elemBadge}>{e.elementSymbol}</span>
              ))}
              {s.elements.length > 12 && (
                <span style={S.moreTag}>+{s.elements.length - 12} more</span>
              )}
            </div>
            <div style={S.setActions}>
              <button onClick={() => openEdit(s)} style={S.editBtn}>✏️ Edit</button>
              <Form method="post" style={{ display: "inline" }}>
                <input type="hidden" name="intent" value="delete" />
                <input type="hidden" name="id" value={s.id} />
                <button type="submit" style={S.deleteBtn} onClick={e => {
                  if (!confirm("Delete this set?")) e.preventDefault();
                }}>🗑️ Delete</button>
              </Form>
            </div>
          </div>
        ))}
        {sets.length === 0 && (
          <div style={S.emptyCard}>No sets created yet. Click "Create Set" to get started.</div>
        )}
      </div>

      {/* Builder Modal */}
      {showBuilder && (
        <div style={S.overlay} onClick={() => setShowBuilder(false)}>
          <div style={S.builderModal} onClick={e => e.stopPropagation()}>
            <div style={S.modalHeader}>
              <h2 style={S.modalTitle}>{editSet ? "✏️ Edit Set" : "➕ Create Set"}</h2>
              <button onClick={() => setShowBuilder(false)} style={S.modalClose}>✕</button>
            </div>
            <Form method="post" style={S.modalBody}>
              <input type="hidden" name="intent" value={editSet ? "update" : "create"} />
              {editSet && <input type="hidden" name="id" value={editSet.id} />}
              <input type="hidden" name="elements" value={JSON.stringify(selected)} />

              <div style={S.formRow}>
                <div style={{ flex: 1 }}>
                  <label style={S.label}>Set Name</label>
                  <input type="text" name="name" required value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Noble Gases Starter Pack" style={S.input} />
                </div>
                <div style={{ width: 140 }}>
                  <label style={S.label}>Type</label>
                  <select name="setType" value={setType} onChange={e => setSetType(e.target.value)} style={S.select}>
                    <option value="Starter">Starter</option>
                    <option value="Complete">Complete</option>
                  </select>
                </div>
                <div style={{ width: 140 }}>
                  <label style={S.label}>Tier</label>
                  <select name="tier" value={tier} onChange={e => setTier(e.target.value)} style={S.select}>
                    <option value="Free">Free</option>
                    <option value="Collector">Collector</option>
                    <option value="Curator">Curator</option>
                    <option value="Lucite Pro">Lucite Pro</option>
                  </select>
                </div>
              </div>

              <label style={S.label}>Description</label>
              <textarea name="description" rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description of this set..." style={S.textarea} />

              <div style={{ marginTop: 16 }}>
                <label style={S.label}>
                  Select Elements ({selected.length} selected)
                </label>
                <MiniPeriodicTable allElements={allElements} selected={selected} onToggle={toggleElement} />
              </div>

              {selected.length > 0 && (
                <div style={S.selectedPreview}>
                  <strong>Selected:</strong>{" "}
                  {selected.map(s => (
                    <span key={s.sym} style={S.elemBadgeSm}>{s.sym}</span>
                  ))}
                  <button type="button" onClick={() => setSelected([])} style={S.clearBtn}>Clear all</button>
                </div>
              )}

              <div style={S.modalActions}>
                <button type="button" onClick={() => setShowBuilder(false)} style={S.cancelBtn}>Cancel</button>
                <button type="submit" style={S.submitBtn} disabled={navigation.state === "submitting"}>
                  {editSet ? "Save Changes" : "Create Set"}
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
  setGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 },
  setCard: { background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", padding: 18 },
  setCardHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  setName: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
  setTypeBadge: { fontSize: 10, padding: "2px 8px", borderRadius: 4, background: "#eef2ff", color: "#4338ca", fontWeight: 600, textTransform: "uppercase" },
  setDesc: { fontSize: 13, color: "#6b7280", marginBottom: 10 },
  setMeta: { display: "flex", gap: 10, marginBottom: 10 },
  tierTag: { fontSize: 11, color: "#4f46e5" },
  countTag: { fontSize: 11, color: "#6b7280" },
  setElements: { display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 12 },
  elemBadge: { fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: "#dbeafe", color: "#1e40af" },
  moreTag: { fontSize: 11, color: "#9ca3af", padding: "2px 4px" },
  setActions: { display: "flex", gap: 8 },
  editBtn: { padding: "4px 10px", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "#4338ca" },
  deleteBtn: { padding: "4px 10px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 4, fontSize: 11, cursor: "pointer", color: "#991b1b" },
  emptyCard: { gridColumn: "1/-1", padding: 40, textAlign: "center", color: "#9ca3af", fontSize: 14, background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb" },
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 20 },
  builderModal: { background: "#fff", borderRadius: 10, width: 820, maxWidth: "95vw", maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.15)" },
  modalHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "16px 20px", borderBottom: "1px solid #e5e7eb" },
  modalTitle: { fontSize: 16, fontWeight: 700, color: "#111827", margin: 0 },
  modalClose: { background: "none", border: "none", fontSize: 18, color: "#9ca3af", cursor: "pointer" },
  modalBody: { padding: 20 },
  formRow: { display: "flex", gap: 12, marginBottom: 4 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6, marginTop: 12 },
  input: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" },
  select: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, background: "#fff", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" },
  selectedPreview: { marginTop: 12, padding: 12, background: "#f0f4ff", borderRadius: 6, fontSize: 12, display: "flex", gap: 4, flexWrap: "wrap", alignItems: "center" },
  elemBadgeSm: { fontSize: 10, fontWeight: 700, padding: "1px 5px", borderRadius: 3, background: "#dbeafe", color: "#1e40af" },
  clearBtn: { background: "none", border: "none", fontSize: 11, color: "#dc2626", cursor: "pointer", marginLeft: 8 },
  modalActions: { display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 20 },
  cancelBtn: { padding: "8px 16px", background: "#fff", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 13, color: "#374151", cursor: "pointer" },
  submitBtn: { padding: "8px 16px", background: "#374151", border: "1px solid #1f2937", borderRadius: 6, fontSize: 13, color: "#fff", cursor: "pointer", fontWeight: 600 },
};
