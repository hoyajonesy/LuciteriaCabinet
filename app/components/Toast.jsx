/**
 * Toast Notification Component
 * 
 * Displays temporary success/error/info messages.
 * Auto-dismisses after a configurable duration.
 */
import { useState, useEffect } from "react";

const TYPE_CONFIG = {
  success: { bg: "#e8f5e9", border: "#4CAF50", icon: "✓", color: "#2e7d32" },
  error:   { bg: "#fce4ec", border: "#e53935", icon: "✕", color: "#b71c1c" },
  info:    { bg: "#e3f2fd", border: "#4a90e2", icon: "ℹ", color: "#1565c0" },
  warning: { bg: "#fff3e0", border: "#f57c00", icon: "⚠", color: "#e65100" },
};

export default function Toast({ message, type = "info", duration = 4000, onDismiss }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!message) return;
    setVisible(true);
    const timer = setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration]);

  if (!message || !visible) return null;

  const cfg = TYPE_CONFIG[type] || TYPE_CONFIG.info;

  return (
    <div style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 10000,
      display: "flex",
      alignItems: "center",
      gap: 10,
      padding: "12px 20px",
      borderRadius: 10,
      background: cfg.bg,
      border: `1px solid ${cfg.border}`,
      color: cfg.color,
      fontSize: 14,
      fontWeight: 500,
      boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
      animation: "slideInRight 0.3s ease",
      maxWidth: 400,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>{cfg.icon}</span>
      <span style={{ flex: 1 }}>{message}</span>
      <button
        onClick={() => { setVisible(false); onDismiss?.(); }}
        style={{
          background: "none",
          border: "none",
          color: cfg.color,
          cursor: "pointer",
          fontSize: 16,
          padding: 0,
          opacity: 0.6,
        }}
      >
        ✕
      </button>
    </div>
  );
}
