/**
 * CollectionTypeSelector — checkbox group for a tier's product-eligibility
 * rules (which collection types the tier ships) plus the "exclude precious
 * metals" safety toggle.
 *
 * Controlled component: parent owns `selected` (string[]) and
 * `excludePreciousMetals` (bool) state and passes change handlers.
 */
import { COLLECTION_TYPES } from "./tier-form-helpers.js";

export default function CollectionTypeSelector({
  selected = [],
  onToggleType,
  excludePreciousMetals = true,
  onToggleExclude,
  error = null,
}) {
  return (
    <fieldset style={styles.fieldset}>
      <legend style={styles.legend}>Product Eligibility</legend>
      <p style={styles.hint}>Choose which collection formats this tier can ship.</p>

      <div style={styles.grid}>
        {COLLECTION_TYPES.map((ct) => {
          const checked = selected.includes(ct.value);
          return (
            <label key={ct.value} style={{ ...styles.option, ...(checked ? styles.optionChecked : {}) }}>
              <input
                type="checkbox"
                name="allowedCollectionTypes"
                value={ct.value}
                checked={checked}
                onChange={() => onToggleType?.(ct.value)}
                style={styles.checkbox}
              />
              <span>{ct.label}</span>
              <code style={styles.code}>{ct.value}</code>
            </label>
          );
        })}
      </div>
      {error && <div style={styles.error}>{error}</div>}

      <label style={styles.toggleRow}>
        <input
          type="checkbox"
          name="excludePreciousMetals"
          checked={excludePreciousMetals}
          onChange={(e) => onToggleExclude?.(e.target.checked)}
          style={styles.checkbox}
        />
        <span>
          <strong>Exclude precious metals</strong>
          <span style={styles.toggleHint}> — never auto-assign Au, Pt, Rh, Ir, Os, Pd, Ru, Re (recommended)</span>
        </span>
      </label>
    </fieldset>
  );
}

const styles = {
  fieldset: { border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, margin: "0 0 20px" },
  legend: { fontSize: 14, fontWeight: 700, color: "#111827", padding: "0 8px" },
  hint: { margin: "0 0 12px", fontSize: 13, color: "#6B7280" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 10 },
  option: {
    display: "flex", alignItems: "center", gap: 8, padding: "10px 12px",
    border: "1px solid #D1D5DB", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#374151",
  },
  optionChecked: { borderColor: "#2563EB", background: "#EFF6FF" },
  checkbox: { width: 16, height: 16, cursor: "pointer" },
  code: { marginLeft: "auto", fontSize: 11, color: "#6366F1", background: "#EEF2FF", padding: "1px 6px", borderRadius: 4 },
  toggleRow: { display: "flex", alignItems: "center", gap: 10, marginTop: 16, padding: "12px", background: "#F9FAFB", borderRadius: 8, cursor: "pointer", fontSize: 13, color: "#374151" },
  toggleHint: { color: "#6B7280", fontWeight: 400 },
  error: { marginTop: 8, fontSize: 12, color: "#DC2626" },
};
