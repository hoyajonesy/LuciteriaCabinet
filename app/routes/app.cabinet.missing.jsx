/**
 * Missing Items Page (Phase 2)
 * 
 * Shows elements the customer doesn't own yet.
 * Collection type aware. Light theme.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams } from "@remix-run/react";
import AppNav from "../components/AppNav";
import ProductCard from "../components/ProductCard";

import * as db from "../data/mock-db.server";

export const loader = ({ request }) => {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer") || "cust_001";

  const customer = db.getCustomerById(customerId);
  const collectionType = customer?.collectionType || "lucite";
  const missing = db.getMissingProducts(customerId, collectionType);
  const wishlistIds = new Set(db.getWishlistProductIds(customerId));

  const enriched = missing.map((p) => ({
    ...p,
    isWishlisted: wishlistIds.has(p.id),
    status: wishlistIds.has(p.id)
      ? "wishlisted"
      : p.inventoryQty <= 0
      ? "out-of-stock"
      : "missing",
  }));

  return json({ customer, missing: enriched, customerId, collectionType });
};

export default function MissingItems() {
  const { customer, missing, customerId, collectionType } = useLoaderData();
  const [searchParams, setSearchParams] = useSearchParams();

  const filterAvailability = searchParams.get("availability") || "all";
  const filterRarity = searchParams.get("rarity") || "all";

  let filtered = missing;
  if (filterAvailability === "in-stock") {
    filtered = filtered.filter((p) => p.inventoryQty > 0);
  } else if (filterAvailability === "out-of-stock") {
    filtered = filtered.filter((p) => p.inventoryQty <= 0);
  }
  if (filterRarity !== "all") {
    filtered = filtered.filter((p) => p.rarityTier === filterRarity);
  }

  const inStockCount = missing.filter((p) => p.inventoryQty > 0).length;
  const outOfStockCount = missing.filter((p) => p.inventoryQty <= 0).length;

  return (
    <div style={styles.layout}>
      <AppNav mode="customer" customerName={customer?.firstName} collectionType={collectionType} />
      <main style={styles.main} className="luc-main">
        <div style={styles.header}>
          <h2 style={styles.title}>The Hunt Continues</h2>
          <p style={styles.subtitle}>
            {missing.length === 0
              ? "🏆 Incredible — you own everything in the catalog. You absolute legend."
              : `${missing.length} elements still elude your cabinet. ${inStockCount} are ready for capture.`}
          </p>
        </div>

        <div style={styles.summaryRow}>
          <div style={styles.summaryBadge}>
            <span style={{ color: "var(--luc-success)", fontWeight: 700 }}>{inStockCount}</span> available now
          </div>
          <div style={styles.summaryBadge}>
            <span style={{ color: "var(--luc-danger)", fontWeight: 700 }}>{outOfStockCount}</span> out of stock
          </div>
          <div style={styles.summaryBadge}>
            <span style={{ color: "var(--luc-warning)", fontWeight: 700 }}>{missing.filter(p => p.isWishlisted).length}</span> on wishlist
          </div>
        </div>

        <div style={styles.filters}>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Availability:</span>
            {["all", "in-stock", "out-of-stock"].map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set("availability", opt);
                  p.set("customer", customerId);
                  setSearchParams(p);
                }}
                style={{
                  ...styles.filterBtn,
                  ...(filterAvailability === opt ? styles.filterBtnActive : {}),
                }}
              >
                {opt === "all" ? "All" : opt === "in-stock" ? "In Stock" : "Out of Stock"}
              </button>
            ))}
          </div>
          <div style={styles.filterGroup}>
            <span style={styles.filterLabel}>Rarity:</span>
            {["all", "common", "uncommon", "rare", "ultra-rare", "legendary"].map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  const p = new URLSearchParams(searchParams);
                  p.set("rarity", opt);
                  p.set("customer", customerId);
                  setSearchParams(p);
                }}
                style={{
                  ...styles.filterBtn,
                  ...(filterRarity === opt ? styles.filterBtnActive : {}),
                }}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1).replace("-", " ")}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.grid}>
          {filtered.map((p) => (
            <ProductCard
              key={p.id}
              product={p}
              status={p.status}
              showPrice={true}
              showStock={true}
              actionLabel={p.isWishlisted ? "✓ On Wishlist" : p.inventoryQty > 0 ? "Add to Wishlist" : "Notify Me"}
              onAction={() => {}}
            />
          ))}
        </div>

        {filtered.length === 0 && missing.length > 0 && (
          <div style={styles.empty}>
            <span style={{ fontSize: 48 }}>🔬</span>
            <p>No elements match these filters. Adjust and try again.</p>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: { marginLeft: 240, flex: 1, padding: "24px 40px 60px", maxWidth: 1000 },
  header: { marginBottom: 20 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 0" },
  summaryRow: { display: "flex", gap: 12, marginBottom: 24 },
  summaryBadge: {
    padding: "8px 16px",
    background: "#ffffff",
    border: "1px solid var(--luc-border)",
    borderRadius: 8,
    fontSize: 13,
    color: "var(--luc-text-muted)",
    boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
  },
  filters: {
    display: "flex", flexDirection: "column", gap: 10, marginBottom: 24,
    paddingBottom: 16, borderBottom: "1px solid var(--luc-border)",
  },
  filterGroup: { display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" },
  filterLabel: { fontSize: 12, color: "var(--luc-text-muted)", fontWeight: 600, minWidth: 80 },
  filterBtn: {
    padding: "5px 12px", borderRadius: 6, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-text-muted)", fontSize: 12, cursor: "pointer",
  },
  filterBtnActive: {
    background: "#EBF3FC", color: "var(--luc-accent)", borderColor: "var(--luc-accent)",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16,
  },
  empty: { textAlign: "center", padding: 60, color: "var(--luc-text-muted)" },
};
