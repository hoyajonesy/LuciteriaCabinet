/**
 * Admin: Subscription Assignment Preview & Override
 *
 * Shows upcoming subscription assignments BEFORE they ship:
 *   - Pre-computed AssignmentPreview sequence (next N shipments per subscriber)
 *   - Shipments currently awaiting review (scheduled / assigned)
 *
 * Lets an admin manually swap the assigned product for a shipment. Every
 * override is validated through the assignment engine, logged to the exception
 * queue (reason = "manual_override"), and reflected in the preview sequence.
 *
 * Nested under the /app/admin layout, which already enforces the isStaff check.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin.server.js";
import {
  getUpcomingAssignments,
  applyManualOverride,
} from "../lib/subscription-manager.server.js";
import { isPreciousMetal } from "../data/elements.server.js";

// Client-safe collection-type matcher (mirrors the primary path of the
// server-side `productMatchesCollectionType`). We rely on each product's own
// `collectionTypes` array, which the loader always serializes, so we avoid
// importing the server-only assignment engine into client code.
function productMatchesCollectionType(product, collectionType) {
  const types = Array.isArray(product.collectionTypes) ? product.collectionTypes : [];
  if (types.length > 0) return types.includes(collectionType);
  return true;
}

function parseArray(value) {
  if (Array.isArray(value)) return value;
  try {
    const v = JSON.parse(value || "[]");
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

export async function loader({ request }) {
  await requireAdmin(request);
  const { previews, pendingReview } = await getUpcomingAssignments({ limit: 100 });

  // Eligible products for override selection (active, in stock, subscription
  // eligible, non-precious). Grouped so the UI can filter by collection type.
  const productsRaw = await prisma.product.findMany({
    where: { status: "Active", inventoryQty: { gt: 0 } },
    orderBy: { atomicNumber: "asc" },
  });

  const eligibleProducts = productsRaw
    .map((p) => ({ ...p, collectionTypes: parseArray(p.collectionTypes) }))
    .filter((p) => !isPreciousMetal(p.elementSymbol))
    .map((p) => ({
      id: p.id,
      sku: p.sku,
      title: p.title,
      elementSymbol: p.elementSymbol,
      priceUsd: p.priceUsd,
      retailPrice: p.retailPrice,
      inventoryQty: p.inventoryQty,
      collectionTypes: p.collectionTypes,
      atomicNumber: p.atomicNumber,
      availableForSubscription: p.availableForSubscription,
    }));

  // Which product is currently assigned to each pending shipment?
  const pending = pendingReview.map((s) => {
    const currentItem = (s.items || [])[0];
    return {
      id: s.id,
      status: s.status,
      shipmentDate: s.shipmentDate,
      assignedBy: s.assignedBy,
      retailPrice: s.retailPrice,
      assignedPrice: s.assignedPrice,
      discountPercent: s.discountPercent,
      notes: s.notes,
      shopifyDraftOrderId: s.shopifyDraftOrderId,
      collectionType: s.subscription?.collectionType || s.customer?.collectionType || "lucite",
      customerName: s.customer ? `${s.customer.firstName} ${s.customer.lastName}` : "Unknown",
      customerEmail: s.customer?.email,
      currentProduct: currentItem?.product
        ? { id: currentItem.product.id, sku: currentItem.product.sku, title: currentItem.product.title, elementSymbol: currentItem.product.elementSymbol }
        : null,
    };
  });

  // Recent overrides (audit trail).
  const recentOverrides = await prisma.assignmentException.findMany({
    where: { reason: "manual_override" },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return json({ previews, pending, eligibleProducts, recentOverrides });
}

export async function action({ request }) {
  const admin = await requireAdmin(request);
  const adminEmail = admin?.email || "admin";

  const form = await request.formData();
  const intent = form.get("intent");

  try {
    if (intent === "override") {
      const shipmentId = form.get("shipmentId");
      const newProductId = form.get("newProductId");
      const reason = form.get("reason") || null;
      if (!shipmentId || !newProductId) {
        return json({ error: "shipmentId and newProductId are required" }, { status: 400 });
      }
      const result = await applyManualOverride({ shipmentId, newProductId, adminEmail, reason });
      return json({
        success: `Assigned ${result.product.title} to shipment ${shipmentId}${
          result.draftOrder?.draftOrderId ? ` (draft order ${result.draftOrder.draftOrderId})` : ""
        }.`,
      });
    }

    if (intent === "approve") {
      // Approve a shipment that is awaiting review → create its draft order.
      const shipmentId = form.get("shipmentId");
      const shipment = await prisma.subscriptionShipment.findUnique({
        where: { id: shipmentId },
        include: { items: true },
      });
      if (!shipment) return json({ error: "Shipment not found" }, { status: 404 });
      const item = shipment.items[0];
      if (!item) return json({ error: "Shipment has no assigned product to approve" }, { status: 400 });

      const [customer, subscription, product] = await Promise.all([
        prisma.customer.findUnique({ where: { id: shipment.customerId } }),
        prisma.subscription.findUnique({ where: { id: shipment.subscriptionId } }),
        prisma.product.findUnique({ where: { id: item.productId } }),
      ]);

      const { createSubscriptionDraftOrder } = await import(
        "../integrations/seal/seal-draft-orders.server.js"
      );
      const draftOrder = await createSubscriptionDraftOrder({
        customer,
        product,
        shipment,
        assignedPrice: shipment.assignedPrice ?? subscription?.priceUsd,
        isFirstShipment: /first/i.test(shipment.notes || ""),
      });
      // Log the manual approval to the audit queue.
      await prisma.assignmentException.create({
        data: {
          customerId: shipment.customerId,
          reason: "manual_override",
          details: `Admin ${adminEmail} approved shipment ${shipmentId} (${product?.sku}) → draft order ${draftOrder?.draftOrderId || "n/a"}`,
          status: "resolved",
          resolvedBy: adminEmail,
          resolvedAt: new Date(),
          resolution: "manual_approval",
        },
      });
      return json({ success: `Approved shipment ${shipmentId} → draft order ${draftOrder?.draftOrderId || "created"}.` });
    }

    return json({ error: `Unknown intent: ${intent}` }, { status: 400 });
  } catch (err) {
    return json({ error: err.message || "Action failed" }, { status: 500 });
  }
}

export default function SubscriptionAssignments() {
  const { previews, pending, eligibleProducts, recentOverrides } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const busy = nav.state !== "idle";

  const productsFor = (collectionType) =>
    eligibleProducts.filter((p) => productMatchesCollectionType(p, collectionType));

  return (
    <div style={styles.wrap}>
      <h2 style={styles.h2}>Subscription Assignments — Preview & Override</h2>
      <p style={styles.sub}>
        Review upcoming assignments before they ship. Swap a product if needed — every override is
        validated by the assignment engine and logged for audit.
      </p>

      {actionData?.success && <div style={styles.ok}>✅ {actionData.success}</div>}
      {actionData?.error && <div style={styles.err}>⚠️ {actionData.error}</div>}

      {/* ── Shipments awaiting review / override ─────────────── */}
      <h3 style={styles.h3}>Awaiting Review ({pending.length})</h3>
      {pending.length === 0 ? (
        <p style={styles.muted}>No shipments are currently awaiting review.</p>
      ) : (
        <div style={styles.cards}>
          {pending.map((s) => {
            const options = productsFor(s.collectionType);
            return (
              <div key={s.id} style={styles.card}>
                <div style={styles.cardHead}>
                  <strong>{s.customerName}</strong>
                  <span style={styles.pill}>{s.collectionType}</span>
                </div>
                <div style={styles.meta}>{s.customerEmail}</div>
                <div style={styles.row}>
                  <span style={styles.label}>Current:</span>{" "}
                  {s.currentProduct
                    ? `${s.currentProduct.title} (${s.currentProduct.elementSymbol})`
                    : "— none assigned —"}
                </div>
                <div style={styles.row}>
                  <span style={styles.label}>Status:</span> {s.status}
                  {s.discountPercent != null && ` · ${s.discountPercent}% off`}
                  {s.shopifyDraftOrderId && ` · draft ${s.shopifyDraftOrderId}`}
                </div>

                <Form method="post" style={styles.form}>
                  <input type="hidden" name="intent" value="override" />
                  <input type="hidden" name="shipmentId" value={s.id} />
                  <select name="newProductId" style={styles.select} required defaultValue="">
                    <option value="" disabled>
                      Swap to… ({options.length} eligible)
                    </option>
                    {options.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.elementSymbol} — {p.title} (${p.priceUsd}, qty {p.inventoryQty})
                      </option>
                    ))}
                  </select>
                  <input name="reason" placeholder="Reason (optional)" style={styles.input} />
                  <div style={styles.actions}>
                    <button type="submit" disabled={busy} style={styles.btn}>
                      Override
                    </button>
                  </div>
                </Form>
                <Form method="post">
                  <input type="hidden" name="intent" value="approve" />
                  <input type="hidden" name="shipmentId" value={s.id} />
                  <button
                    type="submit"
                    disabled={busy || !s.currentProduct}
                    style={styles.btnGhost}
                    title={s.currentProduct ? "Approve current assignment" : "Assign a product first"}
                  >
                    Approve current →
                  </button>
                </Form>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Upcoming preview sequence ────────────────────────── */}
      <h3 style={styles.h3}>Upcoming Sequence Preview ({previews.length})</h3>
      {previews.length === 0 ? (
        <p style={styles.muted}>No preview rows yet. They are generated after the first assignment.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>#</th>
              <th style={styles.th}>Product</th>
              <th style={styles.th}>SKU</th>
              <th style={styles.th}>Est. Date</th>
              <th style={styles.th}>Est. Discount</th>
              <th style={styles.th}>Status</th>
            </tr>
          </thead>
          <tbody>
            {previews.map((p) => (
              <tr key={p.id}>
                <td style={styles.td}>{p.sequencePosition}</td>
                <td style={styles.td}>{p.productTitle || "— none —"}</td>
                <td style={styles.td}>{p.productSku || "—"}</td>
                <td style={styles.td}>{new Date(p.estimatedDate).toLocaleDateString()}</td>
                <td style={styles.td}>
                  {p.estimatedDiscount != null ? `${(p.estimatedDiscount * 100).toFixed(1)}%` : "—"}
                </td>
                <td style={styles.td}>
                  {p.status}
                  {p.shiftedReason ? ` (${p.shiftedReason})` : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* ── Override audit log ───────────────────────────────── */}
      <h3 style={styles.h3}>Recent Overrides ({recentOverrides.length})</h3>
      {recentOverrides.length === 0 ? (
        <p style={styles.muted}>No manual overrides logged yet.</p>
      ) : (
        <ul style={styles.log}>
          {recentOverrides.map((o) => (
            <li key={o.id} style={styles.logItem}>
              <span style={styles.logDate}>{new Date(o.createdAt).toLocaleString()}</span> — {o.details}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const styles = {
  wrap: { padding: "1rem 0" },
  h2: { fontSize: "1.4rem", fontWeight: 700, margin: "0 0 .25rem" },
  h3: { fontSize: "1.1rem", fontWeight: 600, margin: "1.75rem 0 .75rem" },
  sub: { color: "#555", margin: "0 0 1rem", maxWidth: 720 },
  muted: { color: "#888" },
  ok: { background: "#e7f6ec", color: "#1a7f37", padding: ".6rem .9rem", borderRadius: 8, margin: ".5rem 0" },
  err: { background: "#fdecec", color: "#b42318", padding: ".6rem .9rem", borderRadius: 8, margin: ".5rem 0" },
  cards: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "1rem" },
  card: { border: "1px solid #e5e5e5", borderRadius: 12, padding: "1rem", background: "#fff" },
  cardHead: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  pill: { background: "#eef2ff", color: "#3730a3", borderRadius: 999, padding: ".1rem .6rem", fontSize: ".75rem", fontWeight: 600 },
  meta: { color: "#888", fontSize: ".85rem", marginBottom: ".5rem" },
  row: { fontSize: ".9rem", margin: ".2rem 0" },
  label: { color: "#666", fontWeight: 600 },
  form: { marginTop: ".75rem", display: "flex", flexDirection: "column", gap: ".5rem" },
  select: { padding: ".5rem", borderRadius: 8, border: "1px solid #ccc" },
  input: { padding: ".5rem", borderRadius: 8, border: "1px solid #ccc" },
  actions: { display: "flex", gap: ".5rem" },
  btn: { background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: ".5rem 1rem", cursor: "pointer", fontWeight: 600 },
  btnGhost: { background: "transparent", color: "#4f46e5", border: "1px solid #4f46e5", borderRadius: 8, padding: ".4rem .9rem", cursor: "pointer", marginTop: ".5rem", fontWeight: 600 },
  table: { width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 8, overflow: "hidden" },
  th: { textAlign: "left", padding: ".6rem .75rem", borderBottom: "2px solid #eee", fontSize: ".8rem", color: "#666", textTransform: "uppercase" },
  td: { padding: ".55rem .75rem", borderBottom: "1px solid #f0f0f0", fontSize: ".9rem" },
  log: { listStyle: "none", padding: 0, margin: 0 },
  logItem: { padding: ".5rem 0", borderBottom: "1px solid #f0f0f0", fontSize: ".85rem", color: "#444" },
  logDate: { color: "#888", fontWeight: 600 },
};
