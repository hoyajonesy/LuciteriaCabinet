/**
 * TierBadge — Visual membership tier indicator
 * Shows Bronze/Silver/Gold badge with tier-specific colors.
 */
import React from "react";

const TIER_COLORS = {
  Bronze: { bg: "#CD7F32", text: "#fff", icon: "🥉" },
  Silver: { bg: "#C0C0C0", text: "#333", icon: "🥈" },
  Gold:   { bg: "#FFD700", text: "#333", icon: "🥇" },
};

export default function TierBadge({ tierName, size = "md", showIcon = true }) {
  const colors = TIER_COLORS[tierName] || { bg: "#6B7280", text: "#fff", icon: "⭐" };
  const sizes = {
    sm: { fontSize: "11px", padding: "2px 8px" },
    md: { fontSize: "13px", padding: "4px 12px" },
    lg: { fontSize: "15px", padding: "6px 16px" },
  };

  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        backgroundColor: colors.bg,
        color: colors.text,
        borderRadius: "12px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        ...sizes[size],
      }}
    >
      {showIcon && <span>{colors.icon}</span>}
      {tierName}
    </span>
  );
}
