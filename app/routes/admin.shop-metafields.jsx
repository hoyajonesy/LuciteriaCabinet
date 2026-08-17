/**
 * Admin — Shop Metafields Diagnostic & Repair (/admin/shop-metafields)
 *
 * The shop tab groups elements by each Shopify variant's custom.periodic_size
 * metafield. When that value is missing or wrong, elements disappear from (or
 * appear under) the wrong format tab. This tool audits every variant, flags
 * mismatches between the CURRENT metafield and the format INFERRED from the
 * product/variant title + SKU, and lets an admin write corrections back to
 * Shopify — using the app's own credentials, so no secrets are exposed.
 */
import { json } from "@remix-run/node";
import { useLoaderData, useActionData, useNavigation, Form } from "@remix-run/react";
import { useState, useEffect } from "react";
import { requireAdmin } from "../lib/admin-session.server.js";
import { FORMATS } from "../lib/formats.js";
import { loadVariantAudit, applyFixes } from "../lib/shop-metafields.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);
  try {
    const audit = await loadVariantAudit();
    return json({ audit, error: null });
  } catch (err) {
    return json({ audit: null, error: err.message });
  }
};

export const action = async ({ request }) => {
  await requireAdmin(request);
  const form = await request.formData();
  const intent = form.get("intent");

  let variantIds = [];
  if (intent === "fix-one") {
    const id = form.get("variantId");
    if (id) variantIds = [id];
  } else if (intent === "fix-all") {
    variantIds = form.getAll("variantId");
  } else if (intent === "fix-batch") {
    const idsStr = form.get("selectedIds");
    variantIds = idsStr ? JSON.parse(idsStr) : [];
  }

  if (!variantIds.length) {
    return json({ result: null, error: "No variants selected to fix." });
  }

  try {
    const result = await applyFixes(variantIds);
    return json({ result, error: null });
  } catch (err) {
    return json({ result: null, error: err.message });
  }
};

function formatLabel(id) {
  return FORMATS[id]?.name || id || "—";
}

export default function ShopMetafieldsAdmin() {
  const { audit, error } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const [selected, setSelected] = useState(new Set());

  // Clear selection after successful batch fix
  useEffect(() => {
    if (actionData?.result && !actionData?.error) {
      setSelected(new Set());
    }
  }, [actionData]);

  const toggleSelection = (variantId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(variantId)) {
        next.delete(variantId);
      } else {
        next.add(variantId);
      }
      return next;
    });
  };

  const selectAll = (variantIds) => {
    setSelected(new Set(variantIds));
  };

  const deselectAll = () => {
    setSelected(new Set());
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 24, fontWeight: 700, color: "#111827", margin: 0 }}>
          🔧 Shop Metafields
        </h1>
        <p style={{ color: "#6b7280", marginTop: 6, maxWidth: 760, lineHeight: 1.5 }}>
          The shop groups elements by each Shopify variant&rsquo;s{" "}
          <code style={codeStyle}>custom.periodic_size</code> metafield. This tool flags
          variants whose metafield is missing or doesn&rsquo;t match the format implied by
          the product title/SKU, and lets you correct them in Shopify.
        </p>
      </div>

      {error && (
        <div style={{ ...banner, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
          <strong>Couldn&rsquo;t load Shopify data:</strong> {error}
          <div style={{ marginTop: 6, fontSize: 13 }}>
            This tool must run where <code style={codeStyle}>SHOPIFY_ACCESS_TOKEN</code> and{" "}
            <code style={codeStyle}>SHOPIFY_SHOP</code> are configured (production). It won&rsquo;t
            work in a local/dev environment without those credentials.
          </div>
        </div>
      )}

      {actionData?.error && (
        <div style={{ ...banner, background: "#fef2f2", borderColor: "#fecaca", color: "#991b1b" }}>
          {actionData.error}
        </div>
      )}

      {actionData?.result && (
        <div style={{ ...banner, background: "#ecfdf5", borderColor: "#a7f3d0", color: "#065f46" }}>
          <strong>
            Applied {actionData.result.fixed} fix{actionData.result.fixed === 1 ? "" : "es"}
            {actionData.result.failed ? `, ${actionData.result.failed} failed` : ""}.
          </strong>
          <div style={{ marginTop: 6, fontSize: 13 }}>
            Note: the shop caches product data per running instance. Changes appear after the
            next deploy or once the server instance refreshes.
          </div>
          {actionData.result.results.some((r) => !r.ok) && (
            <ul style={{ marginTop: 8, fontSize: 13 }}>
              {actionData.result.results
                .filter((r) => !r.ok)
                .map((r) => (
                  <li key={r.variantId}>
                    {r.productTitle} — {r.variantTitle}: {r.error}
                  </li>
                ))}
            </ul>
          )}
        </div>
      )}

      {audit && (
        <>
          <div style={{ display: "flex", gap: 12, marginBottom: 20, flexWrap: "wrap" }}>
            <StatPill label="Needs fix" value={audit.buckets.needsFix.length} tone="danger" />
            <StatPill label="Unknown format" value={audit.buckets.unknown.length} tone="warn" />
            <StatPill label="OK" value={audit.buckets.ok.length} tone="ok" />
            <StatPill label="Total variants" value={audit.rows.length} tone="neutral" />
          </div>

          {audit.buckets.needsFix.length > 0 && (
            <Section
              title={`Needs fix (${audit.buckets.needsFix.length})`}
              subtitle="Current metafield differs from the format implied by the product. Review the proposed value, then fix."
            >
              <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
                <button
                  type="button"
                  onClick={() => selectAll(audit.buckets.needsFix.map((r) => r.variantId))}
                  style={secondaryBtn}
                  disabled={busy}
                >
                  Select all
                </button>
                <button
                  type="button"
                  onClick={deselectAll}
                  style={secondaryBtn}
                  disabled={busy || selected.size === 0}
                >
                  Deselect all
                </button>
                {selected.size > 0 ? (
                  <Form method="post">
                    <input type="hidden" name="intent" value="fix-batch" />
                    <input type="hidden" name="selectedIds" value={JSON.stringify([...selected])} />
                    <button type="submit" disabled={busy} style={primaryBtn}>
                      {busy ? "Working…" : `Fix selected (${selected.size})`}
                    </button>
                  </Form>
                ) : null}
              </div>
              <FixTable
                rows={audit.buckets.needsFix}
                busy={busy}
                showFix
                selected={selected}
                onToggle={toggleSelection}
              />
            </Section>
          )}

          {audit.buckets.unknown.length > 0 && (
            <Section
              title={`Unknown format (${audit.buckets.unknown.length})`}
              subtitle="Couldn't infer a format from the title/SKU. These need manual review in Shopify — no automatic fix is proposed."
            >
              <FixTable rows={audit.buckets.unknown} busy={busy} showFix={false} />
            </Section>
          )}

          <Section
            title={`OK (${audit.buckets.ok.length})`}
            subtitle="Metafield matches the inferred format."
            collapsedByDefault
          >
            <FixTable rows={audit.buckets.ok} busy={busy} showFix={false} />
          </Section>

          <p style={{ color: "#9ca3af", fontSize: 12, marginTop: 24 }}>
            Data fetched {new Date(audit.generatedAt).toLocaleString()}.
          </p>
        </>
      )}
    </div>
  );
}

function FixTable({ rows, busy, showFix, selected = new Set(), onToggle = () => {} }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={table}>
        <thead>
          <tr>
            {showFix && <th style={{ ...th, width: 40 }}></th>}
            <th style={th}>Symbol</th>
            <th style={th}>Product</th>
            <th style={th}>Variant</th>
            <th style={th}>SKU</th>
            <th style={th}>Current</th>
            <th style={th}>Proposed</th>
            {showFix && <th style={th}>Action</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.variantId}>
              {showFix && (
                <td style={{ ...td, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={selected.has(r.variantId)}
                    onChange={() => onToggle(r.variantId)}
                    disabled={busy}
                    style={{ cursor: "pointer", width: 16, height: 16 }}
                  />
                </td>
              )}
              <td style={{ ...td, fontWeight: 600 }}>{r.symbol || "—"}</td>
              <td style={td}>{r.productTitle}</td>
              <td style={td}>{r.variantTitle}</td>
              <td style={{ ...td, fontFamily: "monospace", fontSize: 12 }}>{r.sku || "—"}</td>
              <td style={td}>
                {r.current.length ? (
                  r.current.map((c) => (
                    <span key={c} style={tag}>{formatLabel(c)}</span>
                  ))
                ) : (
                  <span style={{ color: "#9ca3af" }}>(empty)</span>
                )}
              </td>
              <td style={td}>
                {r.inferred ? (
                  <span style={{ ...tag, background: "#dcfce7", color: "#166534" }}>
                    {formatLabel(r.inferred)}
                  </span>
                ) : (
                  <span style={{ color: "#9ca3af" }}>—</span>
                )}
              </td>
              {showFix && (
                <td style={td}>
                  <Form method="post">
                    <input type="hidden" name="intent" value="fix-one" />
                    <input type="hidden" name="variantId" value={r.variantId} />
                    <button type="submit" disabled={busy} style={smallBtn}>
                      Fix
                    </button>
                  </Form>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({ title, subtitle, children, collapsedByDefault = false }) {
  return (
    <details open={!collapsedByDefault} style={section}>
      <summary style={summary}>{title}</summary>
      {subtitle && <p style={{ color: "#6b7280", fontSize: 13, margin: "6px 0 12px" }}>{subtitle}</p>}
      {children}
    </details>
  );
}

function StatPill({ label, value, tone }) {
  const tones = {
    danger: { background: "#fef2f2", color: "#991b1b", border: "#fecaca" },
    warn: { background: "#fffbeb", color: "#92400e", border: "#fde68a" },
    ok: { background: "#ecfdf5", color: "#065f46", border: "#a7f3d0" },
    neutral: { background: "#f3f4f6", color: "#374151", border: "#e5e7eb" },
  };
  const t = tones[tone] || tones.neutral;
  return (
    <div style={{ padding: "10px 16px", borderRadius: 8, background: t.background, border: `1px solid ${t.border}` }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: t.color }}>{value}</div>
      <div style={{ fontSize: 12, color: t.color }}>{label}</div>
    </div>
  );
}

const codeStyle = { background: "#f3f4f6", padding: "1px 5px", borderRadius: 4, fontSize: 12 };
const banner = { padding: "12px 16px", borderRadius: 8, border: "1px solid", marginBottom: 20 };
const section = { marginBottom: 20, border: "1px solid #e5e7eb", borderRadius: 8, padding: "14px 16px", background: "#fff" };
const summary = { fontWeight: 600, fontSize: 15, color: "#111827", cursor: "pointer" };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 13 };
const th = { textAlign: "left", padding: "8px 10px", borderBottom: "2px solid #e5e7eb", color: "#6b7280", fontSize: 12, whiteSpace: "nowrap" };
const td = { padding: "8px 10px", borderBottom: "1px solid #f3f4f6", color: "#374151", verticalAlign: "top" };
const tag = { display: "inline-block", padding: "2px 8px", borderRadius: 12, background: "#f3f4f6", color: "#374151", fontSize: 12, marginRight: 4 };
const primaryBtn = { background: "#111827", color: "#fff", border: "none", padding: "9px 18px", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const secondaryBtn = { background: "#fff", color: "#374151", border: "1px solid #d1d5db", padding: "9px 18px", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" };
const smallBtn = { background: "#2563eb", color: "#fff", border: "none", padding: "5px 12px", borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: "pointer" };
