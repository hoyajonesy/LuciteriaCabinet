/**
 * Subscription Swap & Skip Window — customer surface (FR-8/FR-9/FR-10/FR-12/FR-13).
 *
 * When a cycle's item is auto-assigned, the shipment enters the held_for_swap
 * state and the collector gets a bounded window to: keep the pick (do nothing),
 * swap it for another eligible item at or below its retail value, or skip the
 * cycle for store credit. This page is the place they act.
 *
 * Entirely behind feature_swap_skip_window: with the flag off no shipment ever
 * enters the held state (FR-26), so this page simply shows an empty state.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useEffect } from "react";
import AppNav from "../components/AppNav";
import ElementPickerModal from "../components/ElementPickerModal";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { prisma } from "../lib/db.server.js";
import {
  isSwapWindowEnabled,
  HELD_STATUS,
  computeSwapPool,
  swapShipment,
  skipShipment,
  getSwapHistory,
} from "../lib/swap-window.server.js";

function productCard(p) {
  if (!p) return null;
  return {
    id: p.id,
    uid: p.id,
    title: p.title,
    name: p.elementName || p.title,
    symbol: p.elementSymbol,
    formatName: p.format,
    imageUrl: p.imageUrl,
    retail: p.retailPrice || p.priceUsd || 0,
  };
}

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  const enabled = await isSwapWindowEnabled();
  const nav = { userType: authUser.userType, isSubscriber: authUser.isSubscriber, firstName: authUser.firstName };

  if (!enabled) {
    return json({ enabled: false, nav, held: null });
  }

  const customer = authUser.email
    ? await prisma.customer.findUnique({ where: { email: authUser.email } })
    : null;

  let held = null;
  if (customer) {
    held = await prisma.subscriptionShipment.findFirst({
      where: { customerId: customer.id, status: HELD_STATUS, finalizationClaimed: false },
      orderBy: { windowOpensAt: "desc" },
    });
  }

  if (!held) {
    return json({ enabled: true, nav, held: null });
  }

  // Current (possibly already-swapped) item and the original pick.
  const currentItem = await prisma.shipmentItem.findFirst({ where: { shipmentId: held.id } });
  const [currentProduct, originalProduct] = await Promise.all([
    currentItem?.productId
      ? prisma.product.findUnique({ where: { id: currentItem.productId } })
      : null,
    held.originalProductId
      ? prisma.product.findUnique({ where: { id: held.originalProductId } })
      : null,
  ]);

  let pool = [];
  let originalRetail = null;
  try {
    const res = await computeSwapPool({ shipment: held });
    pool = res.candidates.map(productCard).filter(Boolean);
    originalRetail = res.originalRetail === Infinity ? null : res.originalRetail;
  } catch {
    pool = [];
  }

  const history = await getSwapHistory(held.id).catch(() => []);

  return json({
    enabled: true,
    nav,
    held: {
      id: held.id,
      windowOpensAt: held.windowOpensAt,
      windowExpiresAt: held.windowExpiresAt,
      swapDecision: held.swapDecision,
      current: productCard(currentProduct),
      original: productCard(originalProduct),
      originalRetail,
    },
    pool,
    history: (history || []).map((h) => ({
      id: h.id,
      action: h.action,
      source: h.source,
      note: h.note,
      createdAt: h.createdAt,
    })),
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });

  const enabled = await isSwapWindowEnabled();
  if (!enabled) return json({ error: "This feature is not currently available." }, { status: 400 });

  const form = await request.formData();
  const intent = form.get("intent");
  const shipmentId = form.get("shipmentId");
  if (!shipmentId) return json({ error: "Missing shipment." }, { status: 400 });

  try {
    if (intent === "swap") {
      const newProductId = form.get("newProductId");
      if (!newProductId) return json({ error: "Choose an item to swap to." }, { status: 400 });
      const res = await swapShipment({ shipmentId, newProductId, userId });
      if (!res.ok) return json({ error: res.message || "Swap could not be completed.", reason: res.reason }, { status: 400 });
      return json({ ok: true, kind: "swap", finalized: res.finalized, product: productCard(res.product) });
    }
    if (intent === "skip") {
      const res = await skipShipment({ shipmentId, userId });
      if (!res.ok) return json({ error: res.message || "Skip could not be completed.", reason: res.reason }, { status: 400 });
      const amount = res.credit && !res.credit.wasAlreadyGranted ? res.credit.transaction?.amount ?? null : null;
      return json({ ok: true, kind: "skip", creditAmount: amount });
    }
  } catch (err) {
    return json({ error: err.message }, { status: 400 });
  }
  return json({ error: "Unknown action." }, { status: 400 });
};

function useCountdown(expiresAt) {
  const [remaining, setRemaining] = useState(() =>
    expiresAt ? Math.max(0, new Date(expiresAt).getTime() - Date.now()) : 0
  );
  useEffect(() => {
    if (!expiresAt) return;
    const t = setInterval(() => {
      setRemaining(Math.max(0, new Date(expiresAt).getTime() - Date.now()));
    }, 1000);
    return () => clearInterval(t);
  }, [expiresAt]);
  return remaining;
}

function fmtRemaining(ms) {
  if (ms <= 0) return "closing now";
  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (d > 0) return `${d}d ${h}h remaining`;
  if (h > 0) return `${h}h ${m}m remaining`;
  if (m > 0) return `${m}m ${s}s remaining`;
  return `${s}s remaining`;
}

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return "—";
  }
}

export default function SwapWindowPage() {
  const data = useLoaderData();
  const { enabled, nav, held } = data;
  const fetcher = useFetcher();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const [confirmSkip, setConfirmSkip] = useState(false);

  const remaining = useCountdown(held?.windowExpiresAt);
  const busy = fetcher.state !== "idle";
  const result = fetcher.data;
  const done = result?.ok;

  const pool = data.pool || [];
  const selected = pool.find((p) => p.id === selectedId) || null;

  return (
    <div style={styles.layout}>
      <AppNav currentPath="/app/cabinet/swap" userType={nav?.userType} isSubscriber={nav?.isSubscriber} />
      <main style={styles.main} className="luc-main">
        <h1 style={styles.title}>Your Next Pick</h1>
        <p style={styles.subtitle}>Keep it, swap it, or skip this cycle for store credit.</p>

        {!enabled && (
          <EmptyState
            icon="🗓️"
            title="Nothing to review right now"
            text="When your next subscription item is selected, you'll be able to review, swap, or skip it here."
          />
        )}

        {enabled && !held && (
          <EmptyState
            icon="✅"
            title="You're all set"
            text="There's no open swap window on your account right now. We'll notify you the moment your next pick is ready to review."
          />
        )}

        {enabled && held && done && (
          <div style={styles.resultCard}>
            <span style={styles.resultIcon}>{result.kind === "skip" ? "💳" : "🔄"}</span>
            <div>
              <div style={styles.resultTitle}>
                {result.kind === "skip"
                  ? "Cycle skipped — store credit added"
                  : result.finalized
                  ? "Swap confirmed — your new pick is on its way"
                  : "Swap recorded"}
              </div>
              <div style={styles.resultText}>
                {result.kind === "skip"
                  ? result.creditAmount != null
                    ? `$${Number(result.creditAmount).toFixed(2)} in store credit has been added to your account.`
                    : "Store credit has been added to your account."
                  : result.product?.name
                  ? `${result.product.name} will ship for this cycle.`
                  : "Your selection has been updated for this cycle."}
              </div>
            </div>
          </div>
        )}

        {enabled && held && !done && (
          <>
            <div style={styles.card}>
              <div style={styles.deadlineRow}>
                <span style={styles.deadlinePill}>⏳ {fmtRemaining(remaining)}</span>
                <span style={styles.deadlineText}>Window closes {fmtDate(held.windowExpiresAt)}</span>
              </div>

              <div style={styles.pickRow}>
                <div style={styles.thumb}>
                  {held.current?.imageUrl ? (
                    <img src={held.current.imageUrl} alt={held.current.name} style={styles.thumbImg} />
                  ) : (
                    <span style={styles.thumbSymbol}>{held.current?.symbol || "?"}</span>
                  )}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={styles.pickLabel}>Currently selected for you</div>
                  <div style={styles.pickName}>{held.current?.name || held.current?.title || "Your next item"}</div>
                  <div style={styles.pickMeta}>
                    {held.current?.symbol}
                    {held.current?.formatName ? ` · ${held.current.formatName}` : ""}
                    {held.current?.retail ? ` · $${held.current.retail.toFixed(2)}` : ""}
                  </div>
                  {held.original && held.current && held.original.id !== held.current.id && (
                    <div style={styles.originalNote}>
                      Originally assigned: {held.original.name}
                    </div>
                  )}
                </div>
              </div>

              <div style={styles.noActionNote}>
                Do nothing and <strong>{held.current?.name || "this item"}</strong> ships automatically when the window closes.
              </div>

              {result?.error && <div style={styles.errorBox}>{result.error}</div>}

              <div style={styles.actionRow}>
                <button
                  type="button"
                  style={styles.swapBtn}
                  disabled={busy || pool.length === 0}
                  onClick={() => setPickerOpen(true)}
                  title={pool.length === 0 ? "No eligible items to swap to right now" : undefined}
                >
                  🔄 Swap for another item{pool.length > 0 ? ` (${pool.length})` : ""}
                </button>
                <button
                  type="button"
                  style={styles.skipBtn}
                  disabled={busy}
                  onClick={() => setConfirmSkip(true)}
                >
                  ⏭ Skip this cycle for credit
                </button>
              </div>
              {pool.length === 0 && (
                <div style={styles.mutedNote}>
                  No eligible swap alternatives are available at or below this item's value right now.
                </div>
              )}
            </div>

            {data.history?.length > 0 && (
              <div style={styles.section}>
                <h3 style={styles.sectionTitle}>Activity</h3>
                <div style={styles.timeline}>
                  {data.history.map((h) => (
                    <div key={h.id} style={styles.timelineRow}>
                      <span style={styles.timelineDot} />
                      <div>
                        <div style={styles.timelineNote}>{h.note || h.action}</div>
                        <div style={styles.timelineMeta}>
                          {fmtDate(h.createdAt)} · {h.source?.toLowerCase()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {/* Swap picker (FR-9) */}
      <ElementPickerModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title="Choose a replacement"
        headerRight={
          held?.originalRetail != null ? `at or below $${held.originalRetail.toFixed(2)}` : null
        }
        gridProps={{
          items: pool,
          isSelected: (el) => el.id === selectedId,
          onToggle: (el) => setSelectedId((cur) => (cur === el.id ? null : el.id)),
          search,
          onSearchChange: setSearch,
          maxSelectable: 1,
          selectedCount: selectedId ? 1 : 0,
          emptyText: "No eligible items to swap to right now.",
        }}
        footer={
          <>
            <span style={{ fontSize: 13, color: "var(--luc-text-muted, #666)" }}>
              {selected ? `Selected: ${selected.name}` : "Select one item"}
            </span>
            <div style={{ display: "flex", gap: 8 }}>
              <button type="button" style={styles.ghostBtn} onClick={() => setPickerOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                style={styles.primaryBtn}
                disabled={!selected || busy}
                onClick={() => {
                  setPickerOpen(false);
                  fetcher.submit(
                    { intent: "swap", shipmentId: held.id, newProductId: selected.id },
                    { method: "post" }
                  );
                }}
              >
                Confirm swap
              </button>
            </div>
          </>
        }
      />

      {/* Skip confirmation */}
      {confirmSkip && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <h3 style={styles.modalTitle}>Skip this cycle?</h3>
            <p style={styles.modalText}>
              We won't ship an item this cycle. Instead, store credit equal to this cycle's value
              {held?.current?.retail ? ` ($${held.current.retail.toFixed(2)})` : ""} will be added to
              your account for a future order. This can't be undone once the window closes.
            </p>
            <div style={styles.modalActions}>
              <button type="button" style={styles.ghostBtn} onClick={() => setConfirmSkip(false)}>
                Never mind
              </button>
              <button
                type="button"
                style={styles.dangerBtn}
                disabled={busy}
                onClick={() => {
                  setConfirmSkip(false);
                  fetcher.submit({ intent: "skip", shipmentId: held.id }, { method: "post" });
                }}
              >
                Skip &amp; get credit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, text }) {
  return (
    <div style={styles.emptyState}>
      <span style={styles.emptyIcon}>{icon}</span>
      <h2 style={styles.emptyTitle}>{title}</h2>
      <p style={styles.emptyText}>{text}</p>
    </div>
  );
}

const styles = {
  layout: { minHeight: "100vh", background: "var(--luc-bg, #faf9f7)" },
  main: { maxWidth: 720, margin: "0 auto", padding: "24px 20px 64px" },
  title: { fontSize: 26, fontWeight: 700, margin: "0 0 4px", color: "var(--luc-text, #1a1a1a)" },
  subtitle: { fontSize: 15, color: "var(--luc-text-muted, #666)", margin: "0 0 24px" },
  card: {
    background: "#fff",
    border: "1px solid var(--luc-border, #e5e2dc)",
    borderRadius: 14,
    padding: 20,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  deadlineRow: { display: "flex", alignItems: "center", gap: 12, marginBottom: 18, flexWrap: "wrap" },
  deadlinePill: {
    fontSize: 13,
    fontWeight: 600,
    background: "#fff3e0",
    color: "#e65100",
    padding: "6px 12px",
    borderRadius: 999,
  },
  deadlineText: { fontSize: 13, color: "var(--luc-text-muted, #666)" },
  pickRow: { display: "flex", gap: 16, alignItems: "center" },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: 12,
    background: "#f4f2ee",
    border: "1px solid var(--luc-border, #e5e2dc)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  thumbImg: { width: "100%", height: "100%", objectFit: "cover" },
  thumbSymbol: { fontSize: 22, fontWeight: 700, color: "var(--luc-text, #1a1a1a)" },
  pickLabel: { fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, color: "var(--luc-text-muted, #999)" },
  pickName: { fontSize: 19, fontWeight: 700, color: "var(--luc-text, #1a1a1a)", margin: "2px 0" },
  pickMeta: { fontSize: 13, color: "var(--luc-text-muted, #666)" },
  originalNote: { fontSize: 12, color: "var(--luc-text-muted, #999)", marginTop: 4 },
  noActionNote: {
    marginTop: 16,
    padding: "10px 14px",
    background: "#f4f7f4",
    borderRadius: 10,
    fontSize: 13,
    color: "#33691e",
  },
  actionRow: { display: "flex", gap: 10, marginTop: 18, flexWrap: "wrap" },
  swapBtn: {
    flex: 1,
    minWidth: 200,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid var(--luc-accent, #1976d2)",
    background: "var(--luc-accent, #1976d2)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  skipBtn: {
    flex: 1,
    minWidth: 200,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid var(--luc-border, #d8d4cc)",
    background: "#fff",
    color: "var(--luc-text, #1a1a1a)",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  mutedNote: { fontSize: 12, color: "var(--luc-text-muted, #999)", marginTop: 10 },
  errorBox: {
    marginTop: 14,
    padding: "10px 14px",
    background: "#fdecea",
    color: "#b71c1c",
    borderRadius: 10,
    fontSize: 13,
  },
  resultCard: {
    display: "flex",
    gap: 16,
    alignItems: "center",
    background: "#fff",
    border: "1px solid var(--luc-border, #e5e2dc)",
    borderRadius: 14,
    padding: 24,
  },
  resultIcon: { fontSize: 34 },
  resultTitle: { fontSize: 17, fontWeight: 700, color: "var(--luc-text, #1a1a1a)" },
  resultText: { fontSize: 14, color: "var(--luc-text-muted, #666)", marginTop: 4 },
  section: { marginTop: 28 },
  sectionTitle: { fontSize: 15, fontWeight: 700, margin: "0 0 12px", color: "var(--luc-text, #1a1a1a)" },
  timeline: { display: "flex", flexDirection: "column", gap: 12 },
  timelineRow: { display: "flex", gap: 12, alignItems: "flex-start" },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
    background: "var(--luc-accent, #1976d2)",
    marginTop: 6,
    flexShrink: 0,
  },
  timelineNote: { fontSize: 14, color: "var(--luc-text, #1a1a1a)" },
  timelineMeta: { fontSize: 12, color: "var(--luc-text-muted, #999)", marginTop: 2 },
  emptyState: { textAlign: "center", padding: "64px 20px" },
  emptyIcon: { fontSize: 44, display: "block", marginBottom: 12 },
  emptyTitle: { fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "var(--luc-text, #1a1a1a)" },
  emptyText: { fontSize: 14, color: "var(--luc-text-muted, #666)", maxWidth: 420, margin: "0 auto" },
  ghostBtn: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #d8d4cc)",
    background: "#fff",
    fontSize: 14,
    cursor: "pointer",
  },
  primaryBtn: {
    padding: "9px 18px",
    borderRadius: 8,
    border: "1px solid var(--luc-accent, #1976d2)",
    background: "var(--luc-accent, #1976d2)",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  dangerBtn: {
    padding: "9px 18px",
    borderRadius: 8,
    border: "1px solid #c62828",
    background: "#c62828",
    color: "#fff",
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  modalOverlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.4)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 50,
    padding: 16,
  },
  modalCard: { background: "#fff", borderRadius: 14, padding: 24, maxWidth: 440, width: "100%" },
  modalTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  modalText: { fontSize: 14, color: "var(--luc-text-muted, #555)", margin: "0 0 20px", lineHeight: 1.5 },
  modalActions: { display: "flex", gap: 10, justifyContent: "flex-end" },
};
