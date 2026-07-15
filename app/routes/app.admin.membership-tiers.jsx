/**
 * Admin: Membership Tier Management
 * CRUD for membership tiers (max 3 enforced).
 * Set pricing, store credit amounts, early access days.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { prisma } from "../lib/db.server.js";
import AppNav from "../components/AppNav.jsx";

export async function loader() {
  const tiers = await prisma.membershipTier.findMany({
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { users: true, userSubscriptions: true } } },
  });
  return json({ tiers });
}

export async function action({ request }) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const activeCount = await prisma.membershipTier.count({ where: { isActive: true } });
    if (activeCount >= 3) {
      return json({ error: "Maximum 3 active membership tiers allowed." }, { status: 400 });
    }

    const totalCount = await prisma.membershipTier.count();
    await prisma.membershipTier.create({
      data: {
        name: form.get("name"),
        displayName: form.get("displayName"),
        monthlyPrice: parseFloat(form.get("monthlyPrice")),
        storeCredit: parseFloat(form.get("storeCredit")),
        earlyAccessDays: parseInt(form.get("earlyAccessDays") || "0"),
        sortOrder: totalCount + 1,
        isActive: true,
      },
    });
    return json({ success: "Tier created successfully." });
  }

  if (intent === "update") {
    const tierId = form.get("tierId");
    await prisma.membershipTier.update({
      where: { id: tierId },
      data: {
        displayName: form.get("displayName"),
        monthlyPrice: parseFloat(form.get("monthlyPrice")),
        storeCredit: parseFloat(form.get("storeCredit")),
        earlyAccessDays: parseInt(form.get("earlyAccessDays") || "0"),
      },
    });
    return json({ success: "Tier updated." });
  }

  if (intent === "toggle") {
    const tierId = form.get("tierId");
    const tier = await prisma.membershipTier.findUnique({ where: { id: tierId } });
    if (!tier.isActive) {
      const activeCount = await prisma.membershipTier.count({ where: { isActive: true } });
      if (activeCount >= 3) {
        return json({ error: "Cannot activate — maximum 3 active tiers." }, { status: 400 });
      }
    }
    await prisma.membershipTier.update({
      where: { id: tierId },
      data: { isActive: !tier.isActive },
    });
    return json({ success: `Tier ${tier.isActive ? "deactivated" : "activated"}.` });
  }

  if (intent === "delete") {
    const tierId = form.get("tierId");
    const subs = await prisma.userSubscription.count({ where: { tierId } });
    if (subs > 0) {
      return json({ error: "Cannot delete tier with active subscriptions." }, { status: 400 });
    }
    await prisma.membershipTier.delete({ where: { id: tierId } });
    return json({ success: "Tier deleted." });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function AdminMembershipTiers() {
  const { tiers } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const isSubmitting = navigation.state === "submitting";
  const activeTiers = tiers.filter(t => t.isActive);

  return (
    <div style={styles.layout}>
      <AppNav mode="admin" />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Membership Tiers</h2>
            <p style={styles.subtitle}>{activeTiers.length}/3 active tiers</p>
          </div>
          {activeTiers.length < 3 && (
            <button style={styles.createBtn} onClick={() => setShowCreate(!showCreate)}>
              {showCreate ? "Cancel" : "+ New Tier"}
            </button>
          )}
        </div>

        {actionData?.error && <div style={styles.error}>{actionData.error}</div>}
        {actionData?.success && <div style={styles.success}>{actionData.success}</div>}

        {showCreate && (
          <Form method="post" style={styles.form}>
            <input type="hidden" name="intent" value="create" />
            <div style={styles.formGrid}>
              <label style={styles.field}>
                <span>Internal Name</span>
                <input name="name" required placeholder="e.g. Gold" style={styles.input} />
              </label>
              <label style={styles.field}>
                <span>Display Name</span>
                <input name="displayName" required placeholder="e.g. Gold Collector" style={styles.input} />
              </label>
              <label style={styles.field}>
                <span>Monthly Price ($)</span>
                <input name="monthlyPrice" type="number" step="0.01" required style={styles.input} />
              </label>
              <label style={styles.field}>
                <span>Store Credit ($)</span>
                <input name="storeCredit" type="number" step="0.01" required style={styles.input} />
              </label>
              <label style={styles.field}>
                <span>Early Access (days)</span>
                <input name="earlyAccessDays" type="number" defaultValue="0" style={styles.input} />
              </label>
            </div>
            <button type="submit" style={styles.submitBtn} disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Tier"}
            </button>
          </Form>
        )}

        <div style={styles.tierGrid}>
          {tiers.map((tier) => (
            <div key={tier.id} style={{ ...styles.tierCard, opacity: tier.isActive ? 1 : 0.6 }}>
              <div style={styles.tierHeader}>
                <div style={styles.tierIcon}>
                  {tier.sortOrder === 1 ? "🥉" : tier.sortOrder === 2 ? "🥈" : "🥇"}
                </div>
                <div>
                  <h3 style={styles.tierName}>{tier.displayName}</h3>
                  <code style={styles.tierCode}>{tier.name}</code>
                </div>
                <span style={{ ...styles.statusBadge, backgroundColor: tier.isActive ? "#D1FAE5" : "#F3F4F6", color: tier.isActive ? "#065F46" : "#6B7280" }}>
                  {tier.isActive ? "Active" : "Inactive"}
                </span>
              </div>

              {editingId === tier.id ? (
                <Form method="post" style={styles.editForm}>
                  <input type="hidden" name="intent" value="update" />
                  <input type="hidden" name="tierId" value={tier.id} />
                  <label style={styles.field}><span>Display Name</span><input name="displayName" defaultValue={tier.displayName} style={styles.input} /></label>
                  <label style={styles.field}><span>Monthly ($)</span><input name="monthlyPrice" type="number" step="0.01" defaultValue={tier.monthlyPrice} style={styles.input} /></label>
                  <label style={styles.field}><span>Credit ($)</span><input name="storeCredit" type="number" step="0.01" defaultValue={tier.storeCredit} style={styles.input} /></label>
                  <label style={styles.field}><span>Early Access (days)</span><input name="earlyAccessDays" type="number" defaultValue={tier.earlyAccessDays} style={styles.input} /></label>
                  <div style={styles.editActions}>
                    <button type="submit" style={styles.saveBtn} disabled={isSubmitting}>Save</button>
                    <button type="button" style={styles.cancelBtn} onClick={() => setEditingId(null)}>Cancel</button>
                  </div>
                </Form>
              ) : (
                <>
                  <div style={styles.stats}>
                    <div style={styles.stat}><span style={styles.statLabel}>Monthly</span><span style={styles.statValue}>${tier.monthlyPrice.toFixed(2)}</span></div>
                    <div style={styles.stat}><span style={styles.statLabel}>Credit</span><span style={styles.statValue}>${tier.storeCredit.toFixed(2)}</span></div>
                    <div style={styles.stat}><span style={styles.statLabel}>Early Access</span><span style={styles.statValue}>{tier.earlyAccessDays}d</span></div>
                    <div style={styles.stat}><span style={styles.statLabel}>Members</span><span style={styles.statValue}>{tier._count.users}</span></div>
                  </div>
                  <div style={styles.tierActions}>
                    <button style={styles.editBtn} onClick={() => setEditingId(tier.id)}>✏️ Edit</button>
                    <Form method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="intent" value="toggle" />
                      <input type="hidden" name="tierId" value={tier.id} />
                      <button type="submit" style={styles.toggleBtn}>{tier.isActive ? "⏸ Deactivate" : "▶ Activate"}</button>
                    </Form>
                    {tier._count.users === 0 && tier._count.userSubscriptions === 0 && (
                      <Form method="post" style={{ display: "inline" }}>
                        <input type="hidden" name="intent" value="delete" />
                        <input type="hidden" name="tierId" value={tier.id} />
                        <button type="submit" style={styles.deleteBtn}>🗑 Delete</button>
                      </Form>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
        </div>

        {tiers.length === 0 && (
          <div style={styles.emptyState}>
            <span style={{ fontSize: "48px" }}>🏆</span>
            <h3>No membership tiers yet</h3>
            <p>Create up to 3 tiers (e.g., Bronze, Silver, Gold) to get started.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "960px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827" },
  subtitle: { margin: "4px 0 0", fontSize: "14px", color: "#6B7280" },
  createBtn: { padding: "8px 20px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  error: { padding: "12px 16px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" },
  success: { padding: "12px 16px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px", fontSize: "14px" },
  form: { padding: "20px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "24px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginBottom: "16px" },
  field: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", fontWeight: 600, color: "#374151" },
  input: { padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: "6px", fontSize: "14px" },
  submitBtn: { padding: "10px 24px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" },
  tierCard: { padding: "20px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB" },
  tierHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "16px" },
  tierIcon: { fontSize: "28px" },
  tierName: { margin: 0, fontSize: "18px", fontWeight: 700, color: "#111827" },
  tierCode: { fontSize: "11px", color: "#6366F1", backgroundColor: "#EEF2FF", padding: "1px 6px", borderRadius: "4px" },
  statusBadge: { marginLeft: "auto", fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 },
  stats: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" },
  stat: { display: "flex", flexDirection: "column" },
  statLabel: { fontSize: "11px", color: "#6B7280", textTransform: "uppercase" },
  statValue: { fontSize: "16px", fontWeight: 700, color: "#111827" },
  tierActions: { display: "flex", gap: "8px", flexWrap: "wrap" },
  editBtn: { padding: "5px 12px", backgroundColor: "#EEF2FF", color: "#4338CA", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  toggleBtn: { padding: "5px 12px", backgroundColor: "#FEF3C7", color: "#92400E", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  deleteBtn: { padding: "5px 12px", backgroundColor: "#FEF2F2", color: "#DC2626", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  editForm: { display: "flex", flexDirection: "column", gap: "8px" },
  editActions: { display: "flex", gap: "8px", marginTop: "8px" },
  saveBtn: { padding: "6px 16px", backgroundColor: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  cancelBtn: { padding: "6px 16px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  emptyState: { textAlign: "center", padding: "48px", color: "#6B7280" },
};
