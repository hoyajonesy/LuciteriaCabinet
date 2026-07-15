/**
 * WishlistShareCard — "Copy Wishlist Link" card for the dashboard.
 * Shows a shareable URL and a copy-to-clipboard button.
 */
import { useState } from "react";

export default function WishlistShareCard({ wishlistToken, userName }) {
  const [copied, setCopied] = useState(false);

  if (!wishlistToken) return null;

  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/wishlist/${wishlistToken}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback for older browsers
      const input = document.createElement("input");
      input.value = shareUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.icon}>🎁</span>
        <div>
          <h4 style={styles.title}>Share Your Wishlist</h4>
          <p style={styles.desc}>
            Friends and family can see what elements you're looking for — perfect for gifts!
          </p>
        </div>
      </div>
      <div style={styles.urlRow}>
        <input
          readOnly
          value={shareUrl}
          style={styles.urlInput}
          onClick={(e) => e.target.select()}
        />
        <button onClick={handleCopy} style={styles.copyBtn}>
          {copied ? "✓ Copied!" : "📋 Copy Link"}
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid var(--luc-border, #e2e5ea)",
    borderRadius: 12,
    padding: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  header: {
    display: "flex",
    gap: 12,
    marginBottom: 14,
    alignItems: "flex-start",
  },
  icon: { fontSize: 28, flexShrink: 0, marginTop: 2 },
  title: {
    fontSize: 15,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    margin: 0,
  },
  desc: {
    fontSize: 13,
    color: "var(--luc-text-muted, #6b7280)",
    margin: "4px 0 0",
    lineHeight: 1.4,
  },
  urlRow: {
    display: "flex",
    gap: 8,
  },
  urlInput: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #e2e5ea)",
    background: "var(--luc-bg, #f5f7fa)",
    fontSize: 12,
    fontFamily: "monospace",
    color: "var(--luc-text-muted, #6b7280)",
    outline: "none",
  },
  copyBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "none",
    background: "var(--luc-accent, #4A90E2)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "background 0.15s",
  },
};
