/**
 * Premium progress bar for collection completion.
 * Phase 2: Updated for light theme.
 */
export default function ProgressBar({ value, max, label, showPct = true, accent = "var(--luc-accent)" }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={styles.wrapper}>
      {label && (
        <div style={styles.label}>
          <span>{label}</span>
          {showPct && <span style={{ color: accent, fontWeight: 600 }}>{pct}%</span>}
        </div>
      )}
      <div style={styles.track}>
        <div style={{ ...styles.fill, width: `${pct}%`, background: accent }} />
      </div>
      <div style={styles.counts}>
        <span style={{ color: accent, fontWeight: 700 }}>{value}</span>
        <span style={styles.divider}>/</span>
        <span>{max}</span>
      </div>
    </div>
  );
}

const styles = {
  wrapper: { width: "100%" },
  label: {
    display: "flex",
    justifyContent: "space-between",
    fontSize: 13,
    fontWeight: 600,
    color: "var(--luc-text-muted)",
    marginBottom: 6,
  },
  track: {
    height: 8,
    background: "#e5e7eb",
    borderRadius: 4,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    borderRadius: 4,
    transition: "width 0.5s ease",
  },
  counts: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 12,
    color: "var(--luc-text-muted)",
    marginTop: 4,
  },
  divider: { opacity: 0.5 },
};
