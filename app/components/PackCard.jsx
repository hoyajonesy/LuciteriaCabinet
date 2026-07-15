/**
 * PackCard — Collector pack preview card
 * Shows pack name, description, SKU count, pricing, and tier restriction.
 */
import React from "react";
import TierBadge from "./TierBadge.jsx";

export default function PackCard({ pack, userTier, onPurchase, onPurchaseWithCredits }) {
  const skuList = typeof pack.skuList === "string" ? JSON.parse(pack.skuList) : (pack.skuList || []);
  const isRestricted = pack.tierName && pack.tierName !== userTier;
  const hasCredit = pack.creditCost && pack.creditCost > 0;

  return (
    <div style={{ ...styles.card, opacity: isRestricted ? 0.6 : 1 }}>
      {pack.imageUrl ? (
        <div style={styles.imageWrap}>
          <img src={pack.imageUrl} alt={pack.name} style={styles.image} />
        </div>
      ) : (
        <div style={styles.imagePlaceholder}>
          <span style={{ fontSize: "32px" }}>📦</span>
          <span style={{ fontSize: "12px", color: "#9CA3AF" }}>{pack.itemCount} items</span>
        </div>
      )}

      <div style={styles.body}>
        <div style={styles.header}>
          <h4 style={styles.title}>{pack.name}</h4>
          {pack.tierName && <TierBadge tierName={pack.tierName} size="sm" />}
        </div>

        <p style={styles.description}>{pack.description}</p>

        <div style={styles.skuPreview}>
          {skuList.slice(0, 5).map((sku, i) => (
            <span key={i} style={styles.skuChip}>{sku}</span>
          ))}
          {skuList.length > 5 && <span style={styles.moreChip}>+{skuList.length - 5} more</span>}
        </div>

        <div style={styles.pricing}>
          {pack.price && (
            <span style={styles.price}>${pack.price.toFixed(2)}</span>
          )}
          {hasCredit && (
            <span style={styles.creditPrice}>💰 {pack.creditCost.toFixed(0)} credits</span>
          )}
        </div>

        {isRestricted ? (
          <div style={styles.restricted}>
            🔒 Requires {pack.tierName} tier or higher
          </div>
        ) : (
          <div style={styles.actions}>
            {pack.price && onPurchase && (
              <button style={styles.buyBtn} onClick={() => onPurchase(pack.id)}>
                Buy Now
              </button>
            )}
            {hasCredit && onPurchaseWithCredits && (
              <button style={styles.creditBtn} onClick={() => onPurchaseWithCredits(pack.id)}>
                💰 Use Credits
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB",
    overflow: "hidden", transition: "box-shadow 0.15s",
  },
  imageWrap: { height: "140px", overflow: "hidden", backgroundColor: "#F9FAFB" },
  image: { width: "100%", height: "100%", objectFit: "cover" },
  imagePlaceholder: {
    height: "140px", backgroundColor: "#F3F4F6", display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "4px",
  },
  body: { padding: "16px" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginBottom: "8px" },
  title: { margin: 0, fontSize: "16px", fontWeight: 700, color: "#111827" },
  description: { fontSize: "13px", color: "#6B7280", margin: "0 0 12px", lineHeight: 1.4 },
  skuPreview: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "12px" },
  skuChip: {
    fontSize: "11px", padding: "2px 8px", backgroundColor: "#EEF2FF",
    color: "#4338CA", borderRadius: "4px", fontFamily: "monospace",
  },
  moreChip: {
    fontSize: "11px", padding: "2px 8px", backgroundColor: "#F3F4F6",
    color: "#6B7280", borderRadius: "4px",
  },
  pricing: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" },
  price: { fontSize: "20px", fontWeight: 700, color: "#111827" },
  creditPrice: { fontSize: "14px", color: "#059669", fontWeight: 600 },
  restricted: {
    padding: "8px 12px", backgroundColor: "#FEF3C7", borderRadius: "6px",
    fontSize: "12px", color: "#92400E", textAlign: "center",
  },
  actions: { display: "flex", gap: "8px" },
  buyBtn: {
    flex: 1, padding: "8px 16px", backgroundColor: "#2563EB", color: "#fff",
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },
  creditBtn: {
    flex: 1, padding: "8px 16px", backgroundColor: "#059669", color: "#fff",
    border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer",
  },
};
