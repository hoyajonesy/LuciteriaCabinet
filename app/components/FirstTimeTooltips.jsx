/**
 * FirstTimeTooltips — dismissible tips for new users.
 * Shows overlay cards pointing to key features.
 */
import { useState } from "react";

const TIPS = [
  {
    id: "periodic-table",
    title: "Your Periodic Table",
    text: "This is the heart of your collection. Green elements are ones you own, blue stars are on your wishlist. Click any element for details!",
    icon: "⚛️",
  },
  {
    id: "collection-tracking",
    title: "Track Your Collection",
    text: "Use the Collection page to browse everything you own. Add new elements anytime from the Missing page.",
    icon: "🧊",
  },
  {
    id: "wishlist",
    title: "Build Your Wishlist",
    text: "Star the elements you want most. Share your wishlist link with friends and family — perfect for gift ideas!",
    icon: "⭐",
  },
];

export default function FirstTimeTooltips({ onDismiss }) {
  const [currentTip, setCurrentTip] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const tip = TIPS[currentTip];
  if (!tip) return null;

  const handleNext = () => {
    if (currentTip < TIPS.length - 1) {
      setCurrentTip(currentTip + 1);
    } else {
      setDismissed(true);
      onDismiss?.();
    }
  };

  const handleSkip = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div style={styles.overlay}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>{tip.icon}</div>
        <h4 style={styles.title}>{tip.title}</h4>
        <p style={styles.text}>{tip.text}</p>
        <div style={styles.footer}>
          <span style={styles.dots}>
            {TIPS.map((_, i) => (
              <span
                key={i}
                style={{
                  ...styles.dot,
                  background: i === currentTip ? "var(--luc-accent, #4A90E2)" : "#ddd",
                }}
              />
            ))}
          </span>
          <div style={styles.actions}>
            <button onClick={handleSkip} style={styles.skipBtn}>
              Skip All
            </button>
            <button onClick={handleNext} style={styles.nextBtn}>
              {currentTip < TIPS.length - 1 ? "Next →" : "Got It!"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.3)",
    zIndex: 9000,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 16,
    padding: "32px 28px 24px",
    maxWidth: 400,
    width: "100%",
    textAlign: "center",
    boxShadow: "0 12px 40px rgba(0,0,0,0.15)",
  },
  iconWrap: {
    fontSize: 48,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    margin: "0 0 8px",
  },
  text: {
    fontSize: 14,
    color: "var(--luc-text-muted, #6b7280)",
    lineHeight: 1.5,
    margin: "0 0 20px",
  },
  footer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dots: {
    display: "flex",
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    transition: "background 0.2s",
  },
  actions: {
    display: "flex",
    gap: 8,
  },
  skipBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--luc-text-muted, #6b7280)",
    fontSize: 13,
    cursor: "pointer",
  },
  nextBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: "var(--luc-accent, #4A90E2)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};
