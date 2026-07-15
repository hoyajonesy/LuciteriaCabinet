/**
 * Product card for collection grid — shows element with status badges.
 * Phase 2: Updated for white/light theme.
 */

const RARITY_COLORS = {
  common: "#059669",
  uncommon: "#2563eb",
  rare: "#7c3aed",
  "ultra-rare": "#c5960c",
  legendary: "#dc2626",
};

const STATUS_STYLES = {
  owned: { bg: "#05966915", border: "#059669", label: "Collected", icon: "✓" },
  missing: { bg: "#ffffff", border: "#e2e5ea", label: "Missing", icon: "" },
  wishlisted: { bg: "#d9770615", border: "#d97706", label: "Wishlisted", icon: "⭐" },
  shipped: { bg: "#2563eb15", border: "#2563eb", label: "Shipped", icon: "📦" },
  "out-of-stock": { bg: "#dc262615", border: "#dc2626", label: "Out of Stock", icon: "∅" },
};

export default function ProductCard({
  product,
  status = "missing",
  showPrice = false,
  showStock = false,
  onAction,
  actionLabel,
  compact = false,
}) {
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.missing;
  const rarityColor = RARITY_COLORS[product.rarityTier] || RARITY_COLORS.common;

  if (compact) {
    return (
      <div style={{ ...styles.compactCard, background: statusStyle.bg, borderColor: statusStyle.border }}>
        <div style={styles.compactSymbol}>{product.elementSymbol}</div>
        <div style={styles.compactNumber}>{product.atomicNumber}</div>
        {statusStyle.icon && <div style={styles.compactBadge}>{statusStyle.icon}</div>}
      </div>
    );
  }

  return (
    <div style={{ ...styles.card, borderColor: statusStyle.border }}>
      <div style={styles.header}>
        <div style={styles.symbolBlock}>
          <span style={styles.atomicNumber}>{product.atomicNumber}</span>
          <span style={styles.symbol}>{product.elementSymbol}</span>
          <span style={styles.elementName}>{product.elementName}</span>
        </div>
        <div style={{ ...styles.rarityBadge, background: rarityColor + "15", color: rarityColor }}>
          {product.rarityTier}
        </div>
      </div>

      <div style={styles.title}>{product.title}</div>

      <div style={{ ...styles.statusBadge, background: statusStyle.bg, color: statusStyle.border }}>
        {statusStyle.icon} {statusStyle.label}
      </div>

      <div style={styles.meta}>
        <span style={styles.metaItem}>📏 {product.format}</span>
        <span style={styles.metaItem}>🏷️ {product.category}</span>
      </div>

      {showPrice && (
        <div style={styles.price}>${product.priceUsd.toFixed(2)}</div>
      )}

      {showStock && (
        <div style={{
          ...styles.stock,
          color: product.inventoryQty > 3 ? "var(--luc-success)" :
                 product.inventoryQty > 0 ? "var(--luc-warning)" :
                 "var(--luc-danger)",
        }}>
          {product.inventoryQty > 0 ? `${product.inventoryQty} in stock` : "Out of stock"}
        </div>
      )}

      {onAction && actionLabel && (
        <button onClick={() => onAction(product)} style={styles.actionBtn}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid",
    borderRadius: 12,
    padding: 16,
    display: "flex",
    flexDirection: "column",
    gap: 10,
    transition: "transform 0.15s ease, box-shadow 0.15s ease",
    cursor: "default",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  symbolBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
  },
  atomicNumber: {
    fontSize: 11,
    color: "var(--luc-text-muted)",
    fontWeight: 600,
  },
  symbol: {
    fontSize: 36,
    fontWeight: 800,
    lineHeight: 1,
    color: "var(--luc-text)",
    letterSpacing: "-0.02em",
  },
  elementName: {
    fontSize: 12,
    color: "var(--luc-text-muted)",
    fontWeight: 500,
  },
  rarityBadge: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    padding: "3px 8px",
    borderRadius: 6,
    letterSpacing: "0.05em",
  },
  title: {
    fontSize: 13,
    color: "var(--luc-text)",
    fontWeight: 500,
    lineHeight: 1.3,
  },
  statusBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  meta: {
    display: "flex",
    gap: 12,
    fontSize: 11,
    color: "var(--luc-text-muted)",
  },
  metaItem: {},
  price: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--luc-gold)",
  },
  stock: {
    fontSize: 12,
    fontWeight: 600,
  },
  actionBtn: {
    background: "var(--luc-accent)",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    padding: "8px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 4,
    transition: "opacity 0.15s",
  },
  compactCard: {
    width: 56,
    height: 56,
    border: "1px solid",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
    cursor: "pointer",
  },
  compactSymbol: {
    fontSize: 18,
    fontWeight: 800,
    color: "var(--luc-text)",
    lineHeight: 1,
  },
  compactNumber: {
    fontSize: 9,
    color: "var(--luc-text-muted)",
  },
  compactBadge: {
    position: "absolute",
    top: -4,
    right: -4,
    fontSize: 10,
  },
};
