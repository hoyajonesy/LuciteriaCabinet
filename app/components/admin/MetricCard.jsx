/**
 * MetricCard — Reusable metric display card for admin dashboards
 */
export default function MetricCard({ title, value, icon = "📊", trend = null, accent = "var(--luc-accent)" }) {
  return (
    <div style={styles.card}>
      <div style={{ ...styles.accentBar, background: accent }} />
      <div style={styles.body}>
        <div style={styles.header}>
          <span style={styles.icon}>{icon}</span>
          <span style={styles.title}>{title}</span>
        </div>
        <div style={styles.value}>{value}</div>
        {trend && (
          <div style={{
            ...styles.trend,
            color: trend.direction === 'up' ? 'var(--luc-success, #2e7d32)' : 'var(--luc-danger, #c62828)',
          }}>
            {trend.direction === 'up' ? '↑' : '↓'} {trend.label}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: '#fff',
    borderRadius: 10,
    border: '1px solid var(--luc-border, #e0e0e0)',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    minWidth: 180,
  },
  accentBar: {
    height: 3,
  },
  body: {
    padding: '16px 18px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  icon: {
    fontSize: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    color: 'var(--luc-text-muted, #888)',
  },
  value: {
    fontSize: 28,
    fontWeight: 700,
    color: 'var(--luc-text, #1a1a1a)',
    lineHeight: 1.2,
  },
  trend: {
    fontSize: 12,
    fontWeight: 500,
    marginTop: 4,
  },
};
