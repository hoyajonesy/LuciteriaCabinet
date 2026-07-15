/**
 * MissingSuggestions — Phase 2 "You're missing these" list
 * Only renders if phase2_suggestions flag is enabled.
 * Display only — no "Add to next shipment" button.
 */
import React from "react";

export default function MissingSuggestions({ suggestions = [] }) {
  if (!suggestions || suggestions.length === 0) return null;

  return (
    <div style={styles.container}>
      <h4 style={styles.heading}>✨ You're Missing These</h4>
      <p style={styles.subtitle}>Elements available in our catalog that you don't own yet</p>
      <div style={styles.list}>
        {suggestions.map((s, i) => (
          <div key={i} style={styles.item}>
            <div style={styles.symbol}>{s.elementSymbol}</div>
            <div style={styles.info}>
              <div style={styles.name}>
                {s.elementName}
                {s.isWishlisted && <span style={styles.wishBadge}>♥ Wishlisted</span>}
              </div>
              <div style={styles.meta}>
                {s.format} · {s.rarityTier} · ${s.price?.toFixed(2)}
              </div>
            </div>
            {s.inStock ? (
              <span style={styles.inStock}>In Stock</span>
            ) : (
              <span style={styles.oos}>Out of Stock</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

const styles = {
  container: {
    padding: "20px", backgroundColor: "#fff", borderRadius: "12px",
    border: "1px solid #E5E7EB",
  },
  heading: { margin: "0 0 4px", fontSize: "16px", fontWeight: 700, color: "#111827" },
  subtitle: { margin: "0 0 16px", fontSize: "13px", color: "#6B7280" },
  list: { display: "flex", flexDirection: "column", gap: "8px" },
  item: {
    display: "flex", alignItems: "center", gap: "12px", padding: "10px 12px",
    backgroundColor: "#F9FAFB", borderRadius: "8px",
  },
  symbol: {
    width: "40px", height: "40px", display: "flex", alignItems: "center", justifyContent: "center",
    backgroundColor: "#EEF2FF", borderRadius: "8px", fontWeight: 700, fontSize: "16px",
    color: "#4338CA", fontFamily: "monospace",
  },
  info: { flex: 1 },
  name: { fontSize: "14px", fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: "6px" },
  meta: { fontSize: "12px", color: "#6B7280", marginTop: "2px" },
  wishBadge: {
    fontSize: "10px", padding: "1px 6px", backgroundColor: "#FEF2F2",
    color: "#DC2626", borderRadius: "4px",
  },
  inStock: {
    fontSize: "11px", padding: "2px 8px", backgroundColor: "#D1FAE5",
    color: "#065F46", borderRadius: "4px", fontWeight: 600,
  },
  oos: {
    fontSize: "11px", padding: "2px 8px", backgroundColor: "#FEE2E2",
    color: "#991B1B", borderRadius: "4px", fontWeight: 600,
  },
};
