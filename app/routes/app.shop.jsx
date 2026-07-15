import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams, Link } from "@remix-run/react";
import { useMemo, useState } from "react";
import AppNav from "../components/AppNav";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { getCollectionStats, getMissingItemsForShop } from "../lib/collection.server";
import { FORMAT_LIST } from "../lib/formats";
import { elementForDisplayFormat, isMixedFormat, productUrlForShopProduct } from "../lib/format-display";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");
  if (!authUser.onboardingCompleted) return redirect("/onboarding/welcome");

  const preferredFormat = authUser.subscriptionFormat || "lucite_cube";
  const stats = await getCollectionStats(userId, preferredFormat);
  const missingItems = await getMissingItemsForShop(userId);
  const formats = FORMAT_LIST.map((f) => ({ id: f.id, name: f.name }));

  return json({
    stats,
    missingItems,
    formats,
    preferredFormat,
    authUser: {
      firstName: authUser.firstName,
      userType: authUser.userType,
      isSubscriber: authUser.isSubscriber,
    },
  });
};

export default function ShopPage() {
  const { stats, missingItems, formats, preferredFormat, authUser } = useLoaderData();
  const [searchParams] = useSearchParams();
  const highlight = searchParams.get("highlight");
  const [filter, setFilter] = useState("all"); // all, wanted, watchlist
  const [groupFilter, setGroupFilter] = useState("ALL");
  const [format, setFormat] = useState(preferredFormat);

  const formattedItems = useMemo(() => {
    return missingItems
      .map((item) => {
        const mappedEl = elementForDisplayFormat(item, format);
        if (!mappedEl) return null;
        return {
          ...item,
          ...mappedEl,
          productUrl: productUrlForShopProduct(mappedEl.product, item.name),
          variantId: mappedEl.product?.variantId || null,
          variantTitle: mappedEl.product?.variantTitle || null,
          sku: mappedEl.product?.sku || null,
        };
      })
      .filter(Boolean);
  }, [missingItems, format]);

  // Get unique groups from items available in the selected format.
  const groups = useMemo(() => {
    return [...new Set(formattedItems.map(item => item.group))].sort();
  }, [formattedItems]);

  // Apply collection-state filters after strict format filtering.
  let filtered = formattedItems;
  if (filter === "wanted") filtered = filtered.filter(i => i.isWanted);
  if (filter === "watchlist") filtered = filtered.filter(i => i.isWatchlist);
  if (groupFilter !== "ALL") filtered = filtered.filter(i => i.group === groupFilter);

  return (
    <div style={styles.layout}>
      <AppNav currentPath="/app/shop" customerName={authUser.firstName} />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h1 style={styles.title}>Element Shop</h1>
            <p style={styles.subtitle}>
              {formattedItems.length} missing product{formattedItems.length !== 1 ? "s" : ""} in this format
            </p>
          </div>
          <Link to="/app/cabinet" style={styles.backLink}>Back to Collection</Link>
        </div>

        {/* Filters */}
        <div style={styles.filterBar}>
          <button
            style={{ ...styles.filterBtn, ...(filter === "all" ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter("all")}
          >
            All Missing ({formattedItems.length})
          </button>
          <button
            style={{ ...styles.filterBtn, ...(filter === "wanted" ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter("wanted")}
          >
            Wanted ({formattedItems.filter(i => i.isWanted).length})
          </button>
          <button
            style={{ ...styles.filterBtn, ...(filter === "watchlist" ? styles.filterBtnActive : {}) }}
            onClick={() => setFilter("watchlist")}
          >
            Watchlist ({formattedItems.filter(i => i.isWatchlist).length})
          </button>
          <select
            style={styles.groupSelect}
            value={groupFilter}
            onChange={e => setGroupFilter(e.target.value)}
          >
            <option value="ALL">All Groups</option>
            {groups.map(g => <option key={g} value={g}>{g}</option>)}
          </select>
          <select
            style={styles.formatSelect}
            value={format}
            onChange={e => {
              setFormat(e.target.value);
              setGroupFilter("ALL");
            }}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>{f.name}</option>
            ))}
          </select>
        </div>

        {/* Results grid */}
        <div key={format} style={styles.grid}>
          {filtered.length === 0 ? (
            <div style={styles.emptyState}>
              <p style={styles.emptyText}>
                {formattedItems.length === 0
                  ? "No missing products are mapped to this format."
                  : `No ${filter} elements found.`}
              </p>
            </div>
          ) : (
            filtered.map(item => {
              const isHighlighted = item.sym === highlight;
              return (
                <a
                  key={`${item.sym}-${format}`}
                  href={item.productUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    ...styles.itemCard,
                    ...(isHighlighted ? styles.itemHighlighted : {}),
                    ...(item.isWanted ? styles.itemWanted : {}),
                  }}
                >
                  <div style={styles.itemHeader}>
                    <span style={styles.itemZ}>{item.z}</span>
                    <span style={styles.itemSymbol}>{item.sym}</span>
                    {item.isWanted && <span style={styles.wantedBadge}>Wanted</span>}
                    {item.isWatchlist && <span style={styles.watchlistBadge}>Watching</span>}
                  </div>
                  <div style={styles.itemName}>{item.name}</div>
                  <div style={styles.itemGroup}>{item.group}</div>
                  <div style={styles.variantLine}>{item.variantTitle || item.sku}</div>
                  <div style={styles.itemActions}>
                    <span style={styles.shopBtn}>View Product</span>
                  </div>
                </a>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", background: "#f8f9fa" },
  main: { flex: 1, marginLeft: 240, padding: "24px 32px", maxWidth: 1200 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 800, color: "#1a1a2e", margin: 0 },
  subtitle: { fontSize: 14, color: "#666", margin: "4px 0 0" },
  backLink: { fontSize: 13, color: "#1976D2", textDecoration: "none" },
  filterBar: {
    display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap",
    padding: "12px 16px", background: "#fff", borderRadius: 10,
    border: "1px solid #e9ecef",
  },
  filterBtn: {
    padding: "6px 14px", borderRadius: 8, border: "1px solid #dee2e6",
    background: "#fff", color: "#555", fontSize: 13, fontWeight: 600,
    cursor: "pointer", transition: "all 0.15s",
  },
  filterBtnActive: {
    background: "#1976D2", color: "#fff", borderColor: "#1976D2",
  },
  groupSelect: {
    marginLeft: "auto", padding: "6px 12px", borderRadius: 8,
    border: "1px solid #dee2e6", fontSize: 12, cursor: "pointer",
  },
  formatSelect: {
    padding: "6px 12px", borderRadius: 8,
    border: "1px solid #1976D2", fontSize: 12, cursor: "pointer",
    color: "#1976D2", background: "#fff",
  },
  grid: {
    display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 16,
  },
  itemCard: {
    background: "#fff", borderRadius: 12, padding: 16,
    border: "1px solid #e9ecef", transition: "transform 0.15s, box-shadow 0.15s",
    textDecoration: "none", color: "inherit", display: "block",
  },
  itemHighlighted: {
    border: "2px solid #1976D2", boxShadow: "0 4px 12px rgba(25, 118, 210, 0.2)",
  },
  itemWanted: {
    borderLeft: "3px solid #F9A825",
  },
  itemHeader: { display: "flex", alignItems: "baseline", gap: 6, marginBottom: 4 },
  itemZ: { fontSize: 10, color: "#999", fontWeight: 600 },
  itemSymbol: { fontSize: 28, fontWeight: 800, color: "#333" },
  wantedBadge: {
    fontSize: 9, color: "#F9A825", fontWeight: 600, marginLeft: "auto",
    background: "#fff9c4", padding: "2px 6px", borderRadius: 4,
  },
  watchlistBadge: {
    fontSize: 9, color: "#1976D2", fontWeight: 600, marginLeft: "auto",
    background: "#e3f2fd", padding: "2px 6px", borderRadius: 4,
  },
  itemName: { fontSize: 14, fontWeight: 600, color: "#333", marginBottom: 2 },
  itemGroup: { fontSize: 11, color: "#888", marginBottom: 6 },
  variantLine: { fontSize: 11, color: "#666", marginBottom: 12, minHeight: 14 },
  itemActions: { display: "flex", gap: 6 },
  shopBtn: {
    flex: 1, padding: "6px 10px", borderRadius: 6,
    background: "#1976D2", color: "#fff", border: "none",
    fontSize: 11, fontWeight: 600, textAlign: "center",
  },
  emptyState: { gridColumn: "1 / -1", textAlign: "center", padding: 40 },
  emptyText: { fontSize: 16, color: "#888" },
};