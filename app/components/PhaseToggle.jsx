/**
 * PhaseToggle — Admin feature flag toggle switch
 */
import React from "react";

export default function PhaseToggle({ flagName, label, description, isEnabled, onToggle }) {
  return (
    <div style={styles.row}>
      <div style={styles.info}>
        <div style={styles.label}>{label}</div>
        <div style={styles.desc}>{description}</div>
        <code style={styles.code}>{flagName}</code>
      </div>
      <button
        style={{
          ...styles.toggle,
          backgroundColor: isEnabled ? "#059669" : "#D1D5DB",
        }}
        onClick={() => onToggle && onToggle(flagName, !isEnabled)}
        aria-label={`Toggle ${flagName}`}
      >
        <span
          style={{
            ...styles.knob,
            transform: isEnabled ? "translateX(20px)" : "translateX(0)",
          }}
        />
      </button>
    </div>
  );
}

const styles = {
  row: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "16px 20px", backgroundColor: "#fff", borderRadius: "10px",
    border: "1px solid #E5E7EB",
  },
  info: { flex: 1, marginRight: "16px" },
  label: { fontSize: "15px", fontWeight: 600, color: "#111827", marginBottom: "2px" },
  desc: { fontSize: "13px", color: "#6B7280", marginBottom: "4px" },
  code: { fontSize: "11px", color: "#6366F1", backgroundColor: "#EEF2FF", padding: "2px 6px", borderRadius: "4px" },
  toggle: {
    width: "48px", height: "28px", borderRadius: "14px", border: "none",
    cursor: "pointer", position: "relative", transition: "background-color 0.2s",
    flexShrink: 0,
  },
  knob: {
    position: "absolute", top: "2px", left: "2px", width: "24px", height: "24px",
    borderRadius: "12px", backgroundColor: "#fff", boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
    transition: "transform 0.2s",
  },
};
