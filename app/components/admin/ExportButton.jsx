/**
 * ExportButton — Reusable CSV export button for admin dashboards
 * Uses form action for server-side CSV generation.
 */
import { Form } from "@remix-run/react";

export default function ExportButton({ exportType, label = "Export CSV", icon = "📥" }) {
  return (
    <Form method="post" style={{ display: 'inline' }}>
      <input type="hidden" name="intent" value="export" />
      <input type="hidden" name="exportType" value={exportType} />
      <button type="submit" style={styles.btn}>
        <span>{icon}</span> {label}
      </button>
    </Form>
  );
}

const styles = {
  btn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    borderRadius: 6,
    border: '1px solid var(--luc-border, #e0e0e0)',
    background: '#fff',
    color: 'var(--luc-text, #1a1a1a)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 0.15s',
  },
};
