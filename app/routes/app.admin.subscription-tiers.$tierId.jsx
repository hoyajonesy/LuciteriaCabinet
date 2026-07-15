/**
 * Admin: Subscription Tier — create / edit form.
 *
 * `/app/admin/subscription-tiers/new`      → create a new tier
 * `/app/admin/subscription-tiers/:tierId`  → edit an existing tier
 *
 * Provides live client-side validation, a configuration preview, and
 * confirmation for pricing changes that would affect current subscribers.
 * The action re-validates on the server before persisting and writes an audit
 * entry via the tier-admin service.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Link, Form } from "@remix-run/react";
import { useState, useMemo } from "react";
import { getUserId } from "../lib/session.server.js";
import { prisma } from "../lib/db.server.js";
import { getTierForAdmin, saveTier } from "../lib/tier-admin.server.js";
import { getAllTiers } from "../lib/subscription-tiers-db.server.js";
import PricingFields from "../components/tier/PricingFields.jsx";
import CollectionTypeSelector from "../components/tier/CollectionTypeSelector.jsx";
import {
  validateTierForm,
  percentToFraction,
  fractionToPercent,
  formatCurrency,
  formatPercent,
  slugifyKey,
} from "../components/tier/tier-form-helpers.js";

export async function loader({ params }) {
  const { tierId } = params;
  const isNew = tierId === "new";

  const allTiers = await getAllTiers();
  const existingKeys = allTiers.map((t) => t.name);

  if (isNew) {
    return json({
      isNew: true,
      tier: {
        name: "",
        displayName: "",
        description: "",
        displayOrder: allTiers.length,
        monthlyPrice: "",
        creditValue: "",
        discountPercentage: 0.2,
        appstleSellingPlanId: "",
        shopifyProductId: "",
        allowedCollectionTypes: [],
        excludePreciousMetals: true,
        isActive: true,
      },
      activeSubscribers: 0,
      eligibleProducts: 0,
      existingKeys,
    });
  }

  const data = await getTierForAdmin(tierId);
  if (!data) throw json({ error: "Tier not found" }, { status: 404 });

  const { tier, activeSubscribers, eligibleProducts } = data;
  return json({
    isNew: false,
    tier: {
      id: tier.id,
      name: tier.name,
      displayName: tier.displayName,
      description: tier.description || "",
      displayOrder: tier.displayOrder ?? 0,
      monthlyPrice: tier.monthlyPrice,
      creditValue: tier.creditValue ?? "",
      discountPercentage: tier.discountPercentage ?? 0.2,
      appstleSellingPlanId: tier.appstleSellingPlanId || "",
      shopifyProductId: tier.shopifyProductId || "",
      allowedCollectionTypes:
        Array.isArray(tier.allowedCollectionTypes) && tier.allowedCollectionTypes.length > 0
          ? tier.allowedCollectionTypes
          : tier.collectionType
            ? [tier.collectionType]
            : [],
      excludePreciousMetals: tier.excludePreciousMetals ?? true,
      isActive: tier.isActive ?? true,
    },
    // Exclude self from the duplicate-key set when editing.
    existingKeys: existingKeys.filter((k) => k !== tier.name),
    activeSubscribers,
    eligibleProducts,
  });
}

export async function action({ request, params }) {
  const userId = await getUserId(request);
  const admin = userId
    ? await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
    : null;
  const actorEmail = admin?.email || "admin";

  const form = await request.formData();
  const isNew = params.tierId === "new";

  const allowedCollectionTypes = form.getAll("allowedCollectionTypes").filter(Boolean);
  const discountFraction = percentToFraction(form.get("discountPercentDisplay"));

  const tier = {
    name: (form.get("name") || "").trim(),
    displayName: (form.get("displayName") || "").trim(),
    description: (form.get("description") || "").trim() || null,
    displayOrder: parseInt(form.get("displayOrder") || "0", 10),
    monthlyPrice: parseFloat(form.get("monthlyPrice")),
    creditValue: form.get("creditValue") ? parseFloat(form.get("creditValue")) : null,
    discountPercentage: discountFraction,
    maxDiscountPercent: discountFraction,
    appstleSellingPlanId: (form.get("appstleSellingPlanId") || "").trim() || null,
    shopifyProductId: (form.get("shopifyProductId") || "").trim() || null,
    allowedCollectionTypes,
    collectionType: allowedCollectionTypes[0] || null,
    excludePreciousMetals: form.get("excludePreciousMetals") === "on",
    isActive: form.get("isActive") === "on",
  };

  // Server-side validation (fraction form for percentages).
  const errors = validateTierForm(
    { ...tier, monthlyPrice: tier.monthlyPrice, discountPercentage: discountFraction },
    { existingKeys: isNew ? (await getAllTiers()).map((t) => t.name) : (await getAllTiers()).map((t) => t.name).filter((k) => k !== tier.name) },
  );
  if (Object.keys(errors).length > 0) {
    return json({ errors, values: { ...tier, discountPercentDisplay: form.get("discountPercentDisplay") } }, { status: 400 });
  }

  try {
    await saveTier(tier, { userId, actorEmail });
  } catch (err) {
    return json({ errors: { _form: err.message || "Save failed." }, values: tier }, { status: 400 });
  }

  return redirect("/app/admin/subscription-tiers");
}

export default function TierForm() {
  const { isNew, tier, activeSubscribers, eligibleProducts } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  // ── Controlled form state ──────────────────────────────
  const [values, setValues] = useState({
    name: tier.name,
    displayName: tier.displayName,
    description: tier.description,
    displayOrder: tier.displayOrder,
    monthlyPrice: tier.monthlyPrice,
    creditValue: tier.creditValue,
    discountPercentDisplay: fractionToPercent(tier.discountPercentage),
    appstleSellingPlanId: tier.appstleSellingPlanId,
    shopifyProductId: tier.shopifyProductId,
    isActive: tier.isActive,
  });
  const [collectionTypes, setCollectionTypes] = useState(tier.allowedCollectionTypes);
  const [excludePrecious, setExcludePrecious] = useState(tier.excludePreciousMetals);
  const [keyEdited, setKeyEdited] = useState(!isNew);

  const set = (field, value) => setValues((v) => ({ ...v, [field]: value }));

  // Auto-slug the key from the display name until the admin edits it manually.
  const onDisplayNameChange = (val) => {
    setValues((v) => ({
      ...v,
      displayName: val,
      name: keyEdited ? v.name : slugifyKey(val),
    }));
  };

  const toggleType = (val) =>
    setCollectionTypes((cur) => (cur.includes(val) ? cur.filter((c) => c !== val) : [...cur, val]));

  // ── Live validation ────────────────────────────────────
  const clientErrors = useMemo(
    () =>
      validateTierForm(
        {
          name: values.name,
          displayName: values.displayName,
          allowedCollectionTypes: collectionTypes,
          monthlyPrice: values.monthlyPrice,
          creditValue: values.creditValue,
          discountPercentage: percentToFraction(values.discountPercentDisplay),
          displayOrder: values.displayOrder,
        },
        {},
      ),
    [values, collectionTypes],
  );
  const errors = { ...(actionData?.errors || {}), ...clientErrors };
  const isValid = Object.keys(clientErrors).length === 0;

  // Warn before saving a price change that affects live subscribers.
  const priceChanged = !isNew && Number(values.monthlyPrice) !== Number(tier.monthlyPrice);
  const confirmIfNeeded = (e) => {
    if (priceChanged && activeSubscribers > 0) {
      const ok = confirm(
        `This price change affects ${activeSubscribers} active subscriber(s).\n\n` +
          `New price: ${formatCurrency(values.monthlyPrice)} (was ${formatCurrency(tier.monthlyPrice)}).\n\n` +
          `Continue?`,
      );
      if (!ok) e.preventDefault();
    }
  };

  return (
    <div style={styles.wrap}>
      <div style={styles.breadcrumb}>
        <Link to="/app/admin/subscription-tiers" style={styles.back}>← Subscription Tiers</Link>
      </div>
      <h2 style={styles.h2}>{isNew ? "Add New Tier" : `Edit: ${tier.displayName}`}</h2>

      {!isNew && (
        <div style={styles.impact}>
          <span><strong>{activeSubscribers}</strong> active subscriber{activeSubscribers === 1 ? "" : "s"}</span>
          <span><strong>{eligibleProducts}</strong> eligible product{eligibleProducts === 1 ? "" : "s"} in pool</span>
        </div>
      )}

      {errors._form && <div style={styles.err}>⚠️ {errors._form}</div>}

      <div style={styles.columns}>
        {/* ── Form ─────────────────────────────── */}
        <Form method="post" style={styles.form} onSubmit={confirmIfNeeded}>
          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Basics</legend>
            <label style={styles.field}>
              <span style={styles.label}>Display Name <span style={styles.req}>*</span></span>
              <input
                name="displayName" value={values.displayName}
                onChange={(e) => onDisplayNameChange(e.target.value)}
                style={styles.input} placeholder="10mm Cubes — Monthly"
              />
              {errors.displayName && <span style={styles.fieldErr}>{errors.displayName}</span>}
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Tier Key (slug) <span style={styles.req}>*</span></span>
              <input
                name="name" value={values.name}
                onChange={(e) => { setKeyEdited(true); set("name", e.target.value); }}
                style={{ ...styles.input, ...(isNew ? {} : styles.inputReadonly) }}
                placeholder="10mm_monthly" readOnly={!isNew}
              />
              <span style={styles.hint}>
                {isNew ? "Unique identifier used by the assignment engine. Cannot be changed later." : "Locked — the key is the stable identifier for this tier."}
              </span>
              {errors.name && <span style={styles.fieldErr}>{errors.name}</span>}
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Description</span>
              <textarea
                name="description" value={values.description}
                onChange={(e) => set("description", e.target.value)}
                style={styles.textarea} rows={2} placeholder="Short description shown to admins."
              />
            </label>

            <label style={styles.field}>
              <span style={styles.label}>Display Order</span>
              <input
                type="number" min="0" name="displayOrder" value={values.displayOrder}
                onChange={(e) => set("displayOrder", e.target.value)}
                style={{ ...styles.input, maxWidth: 120 }}
              />
              {errors.displayOrder && <span style={styles.fieldErr}>{errors.displayOrder}</span>}
            </label>
          </fieldset>

          <PricingFields values={values} onChange={set} errors={errors} />

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Shopify Integration</legend>
            <div style={styles.grid2}>
              <label style={styles.field}>
                <span style={styles.label}>Selling Plan ID</span>
                <input
                  name="appstleSellingPlanId" value={values.appstleSellingPlanId}
                  onChange={(e) => set("appstleSellingPlanId", e.target.value)}
                  style={styles.input} placeholder="gid://shopify/SellingPlan/…"
                />
              </label>
              <label style={styles.field}>
                <span style={styles.label}>Product ID</span>
                <input
                  name="shopifyProductId" value={values.shopifyProductId}
                  onChange={(e) => set("shopifyProductId", e.target.value)}
                  style={styles.input} placeholder="gid://shopify/Product/…"
                />
              </label>
            </div>
          </fieldset>

          <CollectionTypeSelector
            selected={collectionTypes}
            onToggleType={toggleType}
            excludePreciousMetals={excludePrecious}
            onToggleExclude={setExcludePrecious}
            error={errors.allowedCollectionTypes}
          />
          {/* Hidden inputs mirror controlled state so it posts even if unchanged. */}
          {excludePrecious && <input type="hidden" name="excludePreciousMetals" value="on" />}

          <fieldset style={styles.fieldset}>
            <legend style={styles.legend}>Status</legend>
            <label style={styles.toggleRow}>
              <input
                type="checkbox" name="isActive" checked={values.isActive}
                onChange={(e) => set("isActive", e.target.checked)}
                style={styles.checkbox}
              />
              <span><strong>Active</strong> — available for new subscriptions and assignments.</span>
            </label>
          </fieldset>

          {priceChanged && activeSubscribers > 0 && (
            <div style={styles.warn}>
              ⚠️ Changing the price affects <strong>{activeSubscribers}</strong> active subscriber(s). You'll be asked to confirm.
            </div>
          )}

          <div style={styles.actions}>
            <button type="submit" style={{ ...styles.saveBtn, ...(isValid ? {} : styles.saveDisabled) }} disabled={busy || !isValid}>
              {busy ? "Saving…" : isNew ? "Create Tier" : "Save Changes"}
            </button>
            <Link to="/app/admin/subscription-tiers" style={styles.cancelBtn}>Cancel</Link>
          </div>
        </Form>

        {/* ── Live preview ─────────────────────── */}
        <aside style={styles.preview}>
          <h3 style={styles.previewTitle}>Preview</h3>
          <div style={styles.previewCard}>
            <div style={styles.previewHead}>
              <strong style={styles.previewName}>{values.displayName || "Untitled tier"}</strong>
              <span style={{ ...styles.previewStatus, ...(values.isActive ? styles.on : styles.off) }}>
                {values.isActive ? "Active" : "Inactive"}
              </span>
            </div>
            <code style={styles.previewKey}>{values.name || "tier_key"}</code>
            {values.description && <p style={styles.previewDesc}>{values.description}</p>}
            <div style={styles.previewStats}>
              <div><span style={styles.pLabel}>Monthly</span><span style={styles.pVal}>{values.monthlyPrice ? formatCurrency(values.monthlyPrice) : "—"}</span></div>
              <div><span style={styles.pLabel}>Credit</span><span style={styles.pVal}>{values.creditValue ? formatCurrency(values.creditValue) : "—"}</span></div>
              <div><span style={styles.pLabel}>Discount</span><span style={styles.pVal}>{formatPercent(percentToFraction(values.discountPercentDisplay))}</span></div>
            </div>
            <div style={styles.previewFormats}>
              {collectionTypes.length === 0
                ? <span style={styles.previewNoFmt}>No formats selected</span>
                : collectionTypes.map((c) => <span key={c} style={styles.previewFmt}>{c}</span>)}
              {excludePrecious && <span style={styles.previewExcl}>excl. precious metals</span>}
            </div>
          </div>
          <p style={styles.previewNote}>
            {isValid ? "✅ Configuration is valid." : "Complete the required fields to enable saving."}
          </p>
        </aside>
      </div>
    </div>
  );
}

const styles = {
  wrap: { maxWidth: 1040 },
  breadcrumb: { marginBottom: 8 },
  back: { fontSize: 13, color: "#2563EB", textDecoration: "none" },
  h2: { margin: "0 0 12px", fontSize: 22, fontWeight: 700, color: "#111827" },
  impact: { display: "flex", gap: 20, padding: "10px 14px", background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, fontSize: 13, color: "#374151", marginBottom: 16 },
  err: { padding: "12px 16px", background: "#FEF2F2", color: "#DC2626", borderRadius: 8, marginBottom: 16, fontSize: 14 },
  columns: { display: "grid", gridTemplateColumns: "minmax(0, 1fr) 300px", gap: 24, alignItems: "start" },
  form: { minWidth: 0 },
  fieldset: { border: "1px solid #E5E7EB", borderRadius: 12, padding: 20, margin: "0 0 20px" },
  legend: { fontSize: 14, fontWeight: 700, color: "#111827", padding: "0 8px" },
  field: { display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 },
  label: { fontSize: 13, fontWeight: 600, color: "#374151" },
  req: { color: "#DC2626" },
  input: { padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14 },
  inputReadonly: { background: "#F3F4F6", color: "#6B7280", cursor: "not-allowed" },
  textarea: { padding: "8px 10px", border: "1px solid #D1D5DB", borderRadius: 6, fontSize: 14, fontFamily: "inherit", resize: "vertical" },
  hint: { fontSize: 11, color: "#6B7280" },
  fieldErr: { fontSize: 12, color: "#DC2626" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  toggleRow: { display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: "#374151", cursor: "pointer" },
  checkbox: { width: 16, height: 16, cursor: "pointer" },
  warn: { padding: "12px 16px", background: "#FFFBEB", border: "1px solid #FDE68A", color: "#92400E", borderRadius: 8, marginBottom: 16, fontSize: 13 },
  actions: { display: "flex", gap: 12, alignItems: "center" },
  saveBtn: { padding: "10px 24px", background: "#2563EB", color: "#fff", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  saveDisabled: { opacity: 0.5, cursor: "not-allowed" },
  cancelBtn: { padding: "10px 20px", background: "#F3F4F6", color: "#374151", borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: "none" },
  preview: { position: "sticky", top: 16 },
  previewTitle: { fontSize: 13, fontWeight: 700, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 10px" },
  previewCard: { padding: 18, background: "#fff", border: "1px solid #E5E7EB", borderRadius: 12, display: "flex", flexDirection: "column", gap: 10 },
  previewHead: { display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 },
  previewName: { fontSize: 16, color: "#111827" },
  previewStatus: { fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 10 },
  on: { background: "#D1FAE5", color: "#065F46" },
  off: { background: "#F3F4F6", color: "#6B7280" },
  previewKey: { fontSize: 11, color: "#6366F1", background: "#EEF2FF", padding: "1px 6px", borderRadius: 4, alignSelf: "flex-start" },
  previewDesc: { margin: 0, fontSize: 12, color: "#6B7280", lineHeight: 1.4 },
  previewStats: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 },
  pLabel: { display: "block", fontSize: 9, color: "#9CA3AF", textTransform: "uppercase" },
  pVal: { display: "block", fontSize: 14, fontWeight: 700, color: "#111827" },
  previewFormats: { display: "flex", flexWrap: "wrap", gap: 5 },
  previewFmt: { fontSize: 10, fontWeight: 600, color: "#1E40AF", background: "#DBEAFE", padding: "2px 7px", borderRadius: 5 },
  previewExcl: { fontSize: 10, fontWeight: 600, color: "#92400E", background: "#FEF3C7", padding: "2px 7px", borderRadius: 5 },
  previewNoFmt: { fontSize: 11, color: "#DC2626" },
  previewNote: { fontSize: 12, color: "#6B7280", marginTop: 12 },
};
