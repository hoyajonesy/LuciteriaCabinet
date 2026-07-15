/**
 * Stat card component — light-themed summary card with accent top border.
 * Phase 2: Updated for white/light theme.
 */
export default function StatCard({ icon, label, value, subtext, accent = "var(--luc-accent)" }) {
  return (
    <div style={{ ...styles.card, borderTop: `3px solid ${accent}` }}>
      <div style={styles.header}>
        <span style={styles.icon}>{icon}</span>
        <span style={styles.label}>{label}</span>
      </div>
      <div style={{ ...styles.value, color: accent }}>{value}</div>
      {subtext && <div style={styles.subtext}>{subtext}</div>}
    </div>
  );
}

const styles = {
  card: {
    background: "#ffffff",
    border: "1px solid var(--luc-border)",
    borderRadius: 12,
    padding: "20px",
    minWidth: 180,
    flex: "1 1 180px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 12,
  },
  icon: { fontSize: 18 },
  label: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "var(--luc-text-muted)",
  },
  value: {
    fontSize: 32,
    fontWeight: 700,
    lineHeight: 1.1,
    fontFamily: "'DM Sans', Inter, sans-serif",
  },
  subtext: {
    fontSize: 13,
    color: "var(--luc-text-muted)",
    marginTop: 6,
  },
};
