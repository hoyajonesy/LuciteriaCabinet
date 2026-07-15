/**
 * PricingFields — currency & percentage inputs for a tier (monthly price,
 * store-credit value, subscriber discount). Controlled by the parent form.
 *
 * Discount is displayed and entered as a percentage (e.g. "20") but the parent
 * converts it to a 0..1 fraction before saving (see tier-form-helpers).
 */
export default function PricingFields({ values, onChange, errors = {} }) {
  const set = (field) => (e) => onChange?.(field, e.target.value);

  return (
    <fieldset style={styles.fieldset}>
      <legend style={styles.legend}>Pricing</legend>
      <div style={styles.grid}>
        <Field label="Monthly Price" error={errors.monthlyPrice} required>
          <div style={styles.inputWrap}>
            <span style={styles.adorn}>$</span>
            <input
              type="number" min="0" step="0.01" name="monthlyPrice"
              value={values.monthlyPrice ?? ""} onChange={set("monthlyPrice")}
              style={styles.input} placeholder="49.99"
            />
          </div>
        </Field>

        <Field label="Credit Value" error={errors.creditValue} hint="Store credit granted per cycle">
          <div style={styles.inputWrap}>
            <span style={styles.adorn}>$</span>
            <input
              type="number" min="0" step="0.01" name="creditValue"
              value={values.creditValue ?? ""} onChange={set("creditValue")}
              style={styles.input} placeholder="0.00"
            />
          </div>
        </Field>

        <Field label="Discount" error={errors.discountPercentage} required hint="Applied to assigned items">
          <div style={styles.inputWrap}>
            <input
              type="number" min="0" max="100" step="0.5" name="discountPercentDisplay"
              value={values.discountPercentDisplay ?? ""} onChange={set("discountPercentDisplay")}
              style={styles.input} placeholder="20"
            />
            <span style={styles.adornRight}>%</span>
          </div>
        </Field>
      </div>
    </fieldset>
  );
}

function Field({ label, error, hint, required, children }) {
  return (
    <label style={styles.field}>
      <span style={styles.label}>
        {label} {required && <span style={styles.req}>*</span>}
      </span>
      {children}
      {hint && !error && <span style={styles.hint}>{hint}</span>}
      {error && <span style={styles.error}>{error}</span>}
    </label>
  );
}

const styles = {
  fieldset: { border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, margin: "0 0 20px" },
  legend: { fontSize: 14, fontWeight: 700, color: "#111827", padding: "0 8px" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 },
  field: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  req: { color: "#DC2626" },
  inputWrap: { display: "flex", alignItems: "center", border: "1px solid #D1D5DB", borderRadius: 6, overflow: "hidden" },
  adorn: { padding: "0 8px", color: "#6B7280", fontSize: 14, background: "#F9FAFB", alignSelf: "stretch", display: "flex", alignItems: "center" },
  adornRight: { padding: "0 10px", color: "#6B7280", fontSize: 14 },
  input: { flex: 1, padding: "8px 10px", border: "none", outline: "none", fontSize: 14, width: "100%" },
  hint: { fontSize: 11, color: "#6B7280" },
  error: { fontSize: 12, color: "#DC2626" },
};
