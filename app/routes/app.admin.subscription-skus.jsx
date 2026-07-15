/**
 * Admin: SKU Subscription Eligibility
 * Import SKUs from product catalog, toggle eligibility flags, set tier requirements.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { prisma } from "../lib/db.server.js";
import AppNav from "../components/AppNav.jsx";

export async function loader() {
  const subscriptionSkus = await prisma.subscriptionSku.findMany({
    orderBy: { sku: "asc" },
  });
  const products = await prisma.product.findMany({
    where: { status: "Active" },
    orderBy: { sku: "asc" },
    select: { id: true, sku: true, title: true, elementSymbol: true, format: true, inventoryQty: true, priceUsd: true },
  });
  const tiers = await prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  // Merge: map products with their subscription settings
  const skuMap = {};
  for (const s of subscriptionSkus) skuMap[s.sku] = s;

  const merged = products.map(p => ({
    ...p,
    sub: skuMap[p.sku] || null,
  }));

  return json({ products: merged, tiers, totalEligible: subscriptionSkus.filter(s => s.isEligible).length });
}

export async function action({ request }) {
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "toggle") {
    const sku = form.get("sku");
    const productId = form.get("productId");
    const field = form.get("field"); // isEligible, isSubscriberOnly, isEarlyAccess

    const existing = await prisma.subscriptionSku.findUnique({ where: { sku } });
    if (existing) {
      await prisma.subscriptionSku.update({
        where: { sku },
        data: { [field]: !existing[field] },
      });
    } else {
      await prisma.subscriptionSku.create({
        data: { sku, productId, [field]: true },
      });
    }
    return json({ success: `${sku} ${field} toggled.` });
  }

  if (intent === "setTier") {
    const sku = form.get("sku");
    const productId = form.get("productId");
    const minTierId = form.get("minTierId") || null;

    await prisma.subscriptionSku.upsert({
      where: { sku },
      update: { minTierId },
      create: { sku, productId, minTierId },
    });
    return json({ success: `Tier requirement updated for ${sku}.` });
  }

  if (intent === "bulkEligible") {
    const skus = form.get("skus")?.split(",") || [];
    for (const sku of skus) {
      const product = await prisma.product.findUnique({ where: { sku } });
      if (product) {
        await prisma.subscriptionSku.upsert({
          where: { sku },
          update: { isEligible: true },
          create: { sku, productId: product.id, isEligible: true },
        });
      }
    }
    return json({ success: `${skus.length} SKUs marked as eligible.` });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function AdminSubscriptionSkus() {
  const { products, tiers, totalEligible } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const [filter, setFilter] = useState("all"); // all, eligible, subscriber_only, early_access
  const [search, setSearch] = useState("");

  const filtered = products.filter(p => {
    if (search && !p.sku.toLowerCase().includes(search.toLowerCase()) && !p.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (filter === "eligible") return p.sub?.isEligible;
    if (filter === "subscriber_only") return p.sub?.isSubscriberOnly;
    if (filter === "early_access") return p.sub?.isEarlyAccess;
    return true;
  });

  return (
    <div style={styles.layout}>
      <AppNav mode="admin" />
      <main style={styles.main}>
        <h2 style={styles.title}>SKU Subscription Eligibility</h2>
        <p style={styles.subtitle}>{totalEligible} of {products.length} SKUs eligible for subscription</p>

        {actionData?.error && <div style={styles.error}>{actionData.error}</div>}
        {actionData?.success && <div style={styles.success}>{actionData.success}</div>}

        <div style={styles.toolbar}>
          <input
            style={styles.search}
            placeholder="Search SKU or product name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <div style={styles.filters}>
            {["all", "eligible", "subscriber_only", "early_access"].map(f => (
              <button
                key={f}
                style={{ ...styles.filterBtn, ...(filter === f ? styles.filterActive : {}) }}
                onClick={() => setFilter(f)}
              >
                {f === "all" ? "All" : f === "eligible" ? "Eligible" : f === "subscriber_only" ? "Sub Only" : "Early Access"}
              </button>
            ))}
          </div>
        </div>

        {/* Bulk action */}
        <Form method="post" style={{ marginBottom: "16px" }}>
          <input type="hidden" name="intent" value="bulkEligible" />
          <input type="hidden" name="skus" value={filtered.filter(p => !p.sub?.isEligible).map(p => p.sku).join(",")} />
          <button type="submit" style={styles.bulkBtn} disabled={navigation.state === "submitting"}>
            ✅ Mark All Filtered as Eligible ({filtered.filter(p => !p.sub?.isEligible).length})
          </button>
        </Form>

        <div style={styles.table}>
          <div style={styles.tableHeader}>
            <span style={{ width: "100px" }}>SKU</span>
            <span style={{ flex: 1 }}>Product</span>
            <span style={{ width: "60px" }}>Stock</span>
            <span style={{ width: "70px" }}>Price</span>
            <span style={{ width: "80px" }}>Eligible</span>
            <span style={{ width: "80px" }}>Sub Only</span>
            <span style={{ width: "80px" }}>Early</span>
            <span style={{ width: "120px" }}>Min Tier</span>
          </div>
          {filtered.map(p => (
            <div key={p.sku} style={styles.tableRow}>
              <span style={{ width: "100px", fontFamily: "monospace", fontSize: "12px" }}>{p.sku}</span>
              <span style={{ flex: 1, fontSize: "13px" }}>
                <strong>{p.elementSymbol}</strong> — {p.title?.slice(0, 30)}
              </span>
              <span style={{ width: "60px", fontSize: "13px", color: p.inventoryQty > 0 ? "#059669" : "#DC2626" }}>
                {p.inventoryQty}
              </span>
              <span style={{ width: "70px", fontSize: "13px" }}>${p.priceUsd?.toFixed(2)}</span>
              {["isEligible", "isSubscriberOnly", "isEarlyAccess"].map(field => (
                <Form method="post" key={field} style={{ width: "80px" }}>
                  <input type="hidden" name="intent" value="toggle" />
                  <input type="hidden" name="sku" value={p.sku} />
                  <input type="hidden" name="productId" value={p.id} />
                  <input type="hidden" name="field" value={field} />
                  <button type="submit" style={{ ...styles.toggleBtn, backgroundColor: p.sub?.[field] ? "#D1FAE5" : "#F3F4F6" }}>
                    {p.sub?.[field] ? "✅" : "—"}
                  </button>
                </Form>
              ))}
              <Form method="post" style={{ width: "120px" }}>
                <input type="hidden" name="intent" value="setTier" />
                <input type="hidden" name="sku" value={p.sku} />
                <input type="hidden" name="productId" value={p.id} />
                <select name="minTierId" style={styles.select} defaultValue={p.sub?.minTierId || ""} onChange={(e) => e.target.form.submit()}>
                  <option value="">Any</option>
                  {tiers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </Form>
            </div>
          ))}
        </div>

        <p style={{ fontSize: "12px", color: "#9CA3AF", marginTop: "16px" }}>
          Showing {filtered.length} of {products.length} SKUs
        </p>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "1100px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700, color: "#111827" },
  subtitle: { margin: "4px 0 24px", fontSize: "14px", color: "#6B7280" },
  error: { padding: "12px 16px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px" },
  success: { padding: "12px 16px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px" },
  toolbar: { display: "flex", gap: "12px", marginBottom: "16px", flexWrap: "wrap" },
  search: { flex: 1, padding: "8px 12px", border: "1px solid #D1D5DB", borderRadius: "6px", fontSize: "14px", minWidth: "200px" },
  filters: { display: "flex", gap: "4px" },
  filterBtn: { padding: "6px 14px", backgroundColor: "#F3F4F6", color: "#374151", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" },
  filterActive: { backgroundColor: "#2563EB", color: "#fff" },
  bulkBtn: { padding: "8px 16px", backgroundColor: "#059669", color: "#fff", border: "none", borderRadius: "6px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  table: { backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", overflow: "hidden" },
  tableHeader: { display: "flex", alignItems: "center", gap: "8px", padding: "10px 16px", backgroundColor: "#F9FAFB", fontSize: "11px", fontWeight: 700, color: "#6B7280", textTransform: "uppercase" },
  tableRow: { display: "flex", alignItems: "center", gap: "8px", padding: "8px 16px", borderTop: "1px solid #F3F4F6" },
  toggleBtn: { width: "100%", padding: "4px 8px", border: "1px solid #E5E7EB", borderRadius: "4px", fontSize: "14px", cursor: "pointer" },
  select: { width: "100%", padding: "4px", border: "1px solid #D1D5DB", borderRadius: "4px", fontSize: "12px" },
};
