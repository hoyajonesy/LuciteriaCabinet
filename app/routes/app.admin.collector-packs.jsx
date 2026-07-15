/**
 * Admin: Collector Pack Builder
 * Create themed packs, select 3 or 5 SKUs, set tier restrictions, pricing.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { prisma } from "../lib/db.server.js";
import AppNav from "../components/AppNav.jsx";

export async function loader() {
  const packs = await prisma.collectorPack.findMany({
    orderBy: { createdAt: "desc" },
    include: { tier: true },
  });
  const eligibleSkus = await prisma.subscriptionSku.findMany({
    where: { isEligible: true },
  });
  const products = await prisma.product.findMany({
    where: { sku: { in: eligibleSkus.map(s => s.sku) }, status: "Active" },
    orderBy: { elementName: "asc" },
    select: { sku: true, title: true, elementSymbol: true, elementName: true, format: true, priceUsd: true, inventoryQty: true },
  });
  const tiers = await prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  return json({ packs, products, tiers, eligibleCount: eligibleSkus.length });
}

export async function action({ request }) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "create") {
    const skuList = form.get("skuList")?.split(",").filter(Boolean) || [];
    const itemCount = parseInt(form.get("itemCount"));

    if (![3, 5].includes(itemCount)) {
      return json({ error: "Pack must contain exactly 3 or 5 items." }, { status: 400 });
    }
    if (skuList.length !== itemCount) {
      return json({ error: `Selected ${skuList.length} SKUs but pack requires ${itemCount}.` }, { status: 400 });
    }

    // Verify all SKUs are eligible
    const eligible = await prisma.subscriptionSku.findMany({
      where: { sku: { in: skuList }, isEligible: true },
    });
    if (eligible.length !== skuList.length) {
      return json({ error: "Some selected SKUs are not eligible for subscription." }, { status: 400 });
    }

    await prisma.collectorPack.create({
      data: {
        name: form.get("name"),
        description: form.get("description"),
        itemCount,
        skuList: JSON.stringify(skuList),
        tierId: form.get("tierId") || null,
        price: form.get("price") ? parseFloat(form.get("price")) : null,
        creditCost: form.get("creditCost") ? parseFloat(form.get("creditCost")) : null,
        stockLimit: form.get("stockLimit") ? parseInt(form.get("stockLimit")) : null,
        isActive: true,
      },
    });
    return json({ success: "Pack created!" });
  }

  if (intent === "toggle") {
    const packId = form.get("packId");
    const pack = await prisma.collectorPack.findUnique({ where: { id: packId } });
    await prisma.collectorPack.update({ where: { id: packId }, data: { isActive: !pack.isActive } });
    return json({ success: `Pack ${pack.isActive ? "deactivated" : "activated"}.` });
  }

  if (intent === "delete") {
    await prisma.collectorPack.delete({ where: { id: form.get("packId") } });
    return json({ success: "Pack deleted." });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function AdminCollectorPacks() {
  const { packs, products, tiers, eligibleCount } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSkus, setSelectedSkus] = useState([]);
  const [itemCount, setItemCount] = useState(3);
  const [previewPack, setPreviewPack] = useState(null);

  const toggleSku = (sku) => {
    setSelectedSkus(prev => {
      if (prev.includes(sku)) return prev.filter(s => s !== sku);
      if (prev.length >= itemCount) return prev;
      return [...prev, sku];
    });
  };

  return (
    <div style={styles.layout}>
      <AppNav mode="admin" />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Collector Packs</h2>
            <p style={styles.subtitle}>{packs.length} packs · {eligibleCount} eligible SKUs</p>
          </div>
          <button style={styles.createBtn} onClick={() => setShowCreate(!showCreate)}>
            {showCreate ? "Cancel" : "+ New Pack"}
          </button>
        </div>

        {actionData?.error && <div style={styles.error}>{actionData.error}</div>}
        {actionData?.success && <div style={styles.success}>{actionData.success}</div>}

        {showCreate && (
          <div style={styles.createPanel}>
            <h3 style={{ margin: "0 0 16px" }}>Create New Pack</h3>
            <Form method="post">
              <input type="hidden" name="intent" value="create" />
              <input type="hidden" name="skuList" value={selectedSkus.join(",")} />
              <input type="hidden" name="itemCount" value={itemCount} />

              <div style={styles.formGrid}>
                <label style={styles.field}>
                  <span>Pack Name</span>
                  <input name="name" required placeholder="e.g. Rare Earth Pack" style={styles.input} />
                </label>
                <label style={styles.field}>
                  <span>Item Count</span>
                  <select style={styles.input} value={itemCount} onChange={e => { setItemCount(parseInt(e.target.value)); setSelectedSkus([]); }}>
                    <option value="3">3 items</option>
                    <option value="5">5 items</option>
                  </select>
                </label>
                <label style={{ ...styles.field, gridColumn: "span 2" }}>
                  <span>Description</span>
                  <textarea name="description" required placeholder="A curated collection of..." style={{ ...styles.input, minHeight: "60px" }} />
                </label>
                <label style={styles.field}>
                  <span>Price ($, optional)</span>
                  <input name="price" type="number" step="0.01" placeholder="Leave blank for no direct price" style={styles.input} />
                </label>
                <label style={styles.field}>
                  <span>Credit Cost (optional)</span>
                  <input name="creditCost" type="number" step="0.01" placeholder="Leave blank" style={styles.input} />
                </label>
                <label style={styles.field}>
                  <span>Tier Restriction</span>
                  <select name="tierId" style={styles.input}>
                    <option value="">No restriction</option>
                    {tiers.map(t => <option key={t.id} value={t.id}>{t.displayName}</option>)}
                  </select>
                </label>
                <label style={styles.field}>
                  <span>Stock Limit</span>
                  <input name="stockLimit" type="number" placeholder="Unlimited" style={styles.input} />
                </label>
              </div>

              <h4 style={{ margin: "16px 0 8px" }}>Select {itemCount} SKUs ({selectedSkus.length}/{itemCount})</h4>
              <div style={styles.skuGrid}>
                {products.map(p => {
                  const selected = selectedSkus.includes(p.sku);
                  return (
                    <button
                      key={p.sku}
                      type="button"
                      style={{ ...styles.skuItem, ...(selected ? styles.skuSelected : {}) }}
                      onClick={() => toggleSku(p.sku)}
                      disabled={!selected && selectedSkus.length >= itemCount}
                    >
                      <strong>{p.elementSymbol}</strong>
                      <span style={{ fontSize: "11px" }}>{p.sku}</span>
                      <span style={{ fontSize: "11px", color: "#6B7280" }}>${p.priceUsd?.toFixed(2)}</span>
                      {selected && <span style={styles.check}>✓</span>}
                    </button>
                  );
                })}
              </div>

              <button
                type="submit"
                style={{ ...styles.submitBtn, opacity: selectedSkus.length !== itemCount ? 0.5 : 1 }}
                disabled={selectedSkus.length !== itemCount || navigation.state === "submitting"}
              >
                Create Pack ({selectedSkus.length}/{itemCount} selected)
              </button>
            </Form>
          </div>
        )}

        <div style={styles.packGrid}>
          {packs.map(pack => {
            const skuList = JSON.parse(pack.skuList || "[]");
            return (
              <div key={pack.id} style={{ ...styles.packCard, opacity: pack.isActive ? 1 : 0.6 }}>
                <div style={styles.packHeader}>
                  <h3 style={styles.packName}>{pack.name}</h3>
                  <span style={{ ...styles.badge, backgroundColor: pack.isActive ? "#D1FAE5" : "#F3F4F6" }}>
                    {pack.isActive ? "Active" : "Inactive"}
                  </span>
                </div>
                <p style={styles.packDesc}>{pack.description}</p>
                <div style={styles.packMeta}>
                  <span>📦 {pack.itemCount} items</span>
                  {pack.price && <span>💵 ${pack.price.toFixed(2)}</span>}
                  {pack.creditCost && <span>💰 {pack.creditCost} credits</span>}
                  {pack.tier && <span>🏆 {pack.tier.displayName}+</span>}
                  {pack.stockLimit && <span>📊 Limit: {pack.stockLimit}</span>}
                </div>
                <div style={styles.skuTags}>
                  {skuList.map(sku => <span key={sku} style={styles.skuTag}>{sku}</span>)}
                </div>
                <div style={styles.packActions}>
                  <Form method="post" style={{ display: "inline" }}>
                    <input type="hidden" name="intent" value="toggle" />
                    <input type="hidden" name="packId" value={pack.id} />
                    <button type="submit" style={styles.actionBtn}>{pack.isActive ? "⏸ Deactivate" : "▶ Activate"}</button>
                  </Form>
                  <Form method="post" style={{ display: "inline" }}>
                    <input type="hidden" name="intent" value="delete" />
                    <input type="hidden" name="packId" value={pack.id} />
                    <button type="submit" style={{ ...styles.actionBtn, color: "#DC2626" }}>🗑 Delete</button>
                  </Form>
                </div>
              </div>
            );
          })}
        </div>

        {packs.length === 0 && !showCreate && (
          <div style={styles.emptyState}>
            <span style={{ fontSize: "48px" }}>📦</span>
            <h3>No collector packs yet</h3>
            <p>First mark SKUs as eligible, then create themed packs here.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "1100px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700 },
  subtitle: { margin: "4px 0 0", fontSize: "14px", color: "#6B7280" },
  createBtn: { padding: "8px 20px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  error: { padding: "12px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px" },
  success: { padding: "12px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px" },
  createPanel: { padding: "24px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "24px" },
  formGrid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" },
  field: { display: "flex", flexDirection: "column", gap: "4px", fontSize: "13px", fontWeight: 600, color: "#374151" },
  input: { padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: "6px", fontSize: "14px" },
  skuGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "8px", marginBottom: "16px", maxHeight: "300px", overflowY: "auto" },
  skuItem: {
    padding: "8px", backgroundColor: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: "6px",
    cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: "2px",
    fontSize: "13px", position: "relative", transition: "all 0.1s",
  },
  skuSelected: { backgroundColor: "#EEF2FF", borderColor: "#6366F1" },
  check: { position: "absolute", top: "4px", right: "4px", color: "#059669", fontWeight: 700 },
  submitBtn: { padding: "10px 24px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "pointer" },
  packGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "16px" },
  packCard: { padding: "20px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB" },
  packHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" },
  packName: { margin: 0, fontSize: "18px", fontWeight: 700 },
  badge: { fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 },
  packDesc: { fontSize: "13px", color: "#6B7280", margin: "0 0 12px" },
  packMeta: { display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "12px", color: "#374151", marginBottom: "12px" },
  skuTags: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" },
  skuTag: { fontSize: "10px", padding: "2px 6px", backgroundColor: "#EEF2FF", color: "#4338CA", borderRadius: "3px", fontFamily: "monospace" },
  packActions: { display: "flex", gap: "8px" },
  actionBtn: { padding: "5px 12px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  emptyState: { textAlign: "center", padding: "48px", color: "#6B7280" },
};
