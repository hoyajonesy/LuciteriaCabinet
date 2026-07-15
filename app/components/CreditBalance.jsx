/**
 * CreditBalance — Display store credit with icon
 */
import React from "react";

export default function CreditBalance({ amount = 0, size = "md", showLabel = true }) {
  const sizes = {
    sm: { fontSize: "14px", iconSize: "16px" },
    md: { fontSize: "18px", iconSize: "20px" },
    lg: { fontSize: "24px", iconSize: "28px" },
  };
  const s = sizes[size];

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
      <span style={{ fontSize: s.iconSize }}>💰</span>
      <div>
        {showLabel && <div style={{ fontSize: "11px", color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px" }}>Store Credit</div>}
        <div style={{ fontSize: s.fontSize, fontWeight: 700, color: amount > 0 ? "#059669" : "#6B7280" }}>
          ${amount.toFixed(2)}
        </div>
      </div>
    </div>
  );
}
