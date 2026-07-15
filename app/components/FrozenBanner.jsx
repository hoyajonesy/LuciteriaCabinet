/**
 * FrozenBanner — Shows a persistent banner when user account is frozen.
 * Users can view but not modify their collection.
 */
export default function FrozenBanner({ show = false }) {
  if (!show) return null;

  return (
    <div style={styles.banner}>
      <div style={styles.content}>
        <span style={styles.icon}>❄️</span>
        <div>
          <strong style={styles.title}>Your account is frozen.</strong>
          <p style={styles.message}>
            You can view your collection but cannot make changes. 
            Contact <a href="mailto:support@luciteria.com" style={styles.link}>support@luciteria.com</a> to restore access.
          </p>
        </div>
      </div>
    </div>
  );
}

const styles = {
  banner: {
    background: "linear-gradient(135deg, #fef2f2, #fff1f2)",
    border: "1px solid #fecaca",
    borderRadius: 8,
    padding: "12px 18px",
    marginBottom: 16,
  },
  content: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
  },
  icon: {
    fontSize: 22,
    flexShrink: 0,
    marginTop: 2,
  },
  title: {
    fontSize: 14,
    color: "#991b1b",
  },
  message: {
    fontSize: 12,
    color: "#7f1d1d",
    margin: "2px 0 0",
    lineHeight: 1.5,
  },
  link: {
    color: "#2563eb",
    textDecoration: "underline",
  },
};
