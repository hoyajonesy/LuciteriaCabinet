/**
 * Collection — Periodic Table view.
 * Click an element to open a status overlay (Owned / Wanted / Watchlist /
 * Missing). From the overlay you can add or edit acquisition notes, which
 * support MULTIPLE physical samples per element. Status filter checkboxes
 * (Owned / Wanted / Watchlist / Missing) control what is highlighted, and
 * elements with more than one sample show a count badge.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { useState, useCallback, useEffect, useMemo } from "react";
import AppNav from "../components/AppNav";
import WireframePeriodicTable from "../components/WireframePeriodicTable";
import NotesModal from "../components/NotesModal";
import ElementStatusOverlay from "../components/ElementStatusOverlay";

import { ELEMENTS_118 } from "../data/elements.server";
import { getUserId } from "../lib/session.server";
import { requireNotFrozen } from "../lib/frozen-guard.server";
import { getUserById } from "../lib/auth.server";
import {
  getCollectionStats,
  getClosestToCompletion,
  getNextBestRecommendations,
  getActivityFeed,
  updateCollectionState,
  getUserCollectionByState,
} from "../lib/collection.server";
import { checkMilestones } from "../lib/milestones.server";
import { getSamples, getSampleCounts, saveSamples } from "../lib/samples.server";
import { notifyMilestone, getUnreadCount } from "../lib/notifications-db.server";
import { getActiveFormats, getFormatMaps, preferredFormatKey } from "../lib/formats-db.server";

export const loader = async ({ request }) => {
  const { getProductLinkWithFallback } = await import("../data/product-links.server");
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");
  if (!authUser.onboardingCompleted) return redirect("/onboarding/welcome");

  const format = authUser.subscriptionFormat || "lucite_cube";
  const stats = await getCollectionStats(userId, format);
  const closestGroups = await getClosestToCompletion(userId);
  const recommendations = await getNextBestRecommendations(userId, 3, format);
  const activityFeed = await getActivityFeed(userId, 5);
  const unreadCount = await getUnreadCount(userId);
  const sampleCounts = await getSampleCounts(userId);

  // Active formats (single source of truth) + this collector's default format.
  const activeFormats = await getActiveFormats();
  const { activeKeys } = await getFormatMaps();
  const preferredFormat = preferredFormatKey(authUser, activeKeys);

  const collectionStates = {};
  for (const sym of stats.ownedSymbols) collectionStates[sym] = "OWNED";
  for (const sym of stats.wantedSymbols) collectionStates[sym] = "WANTED";
  for (const sym of stats.watchlistSymbols) collectionStates[sym] = "WATCHLIST";

  const elements = ELEMENTS_118.map((e) => ({
    z: e.z,
    sym: e.sym,
    name: e.name,
    row: e.row,
    col: e.col,
    group: e.group,
    phase: e.phase,
    size: e.size,
    productsByFormat: e.productsByFormat || {},
  }));

  // Attach a product link to each recommendation (for the "View in Shop" link)
  const wantedItems = await getUserCollectionByState(userId, "WANTED");
  const wishlistItemsBySym = new Map(wantedItems.map(it => [it.elementSymbol, it]));

  const recs = recommendations.map((r) => {
    const wishlistItem = wishlistItemsBySym.get(r.element.sym);
    let link = null;

    if (wishlistItem) {
      const el = ELEMENTS_118.find((e) => e.sym === r.element.sym);
      let variant = null;
      const preferredFormat = wishlistItem.format || format;

      if (preferredFormat && el?.productsByFormat?.[preferredFormat]) {
        variant = el.productsByFormat[preferredFormat];
      } else if (el?.products && el.products.length > 0) {
        variant = el.products[0];
      }

      if (variant) {
        const variantId = variant.variantId ? variant.variantId.split("/").pop() : "";
        const variantQuery = variantId ? `?variant=${variantId}` : "";
        link = {
          url: `https://luciteria.com/products/${variant.handle}${variantQuery}`,
          inStock: variant.inventoryQty > 0,
          isFallback: false,
          title: variant.title,
        };
      }
    }

    if (!link) {
      const preferredFormat = wishlistItem?.format || format;
      link = getProductLinkWithFallback(r.element.sym, preferredFormat, r.element.name);
    }

    return {
      element: { z: r.element.z, sym: r.element.sym, name: r.element.name },
      reason: r.reason,
      link,
    };
  });

  return json({
    elements,
    collectionStates,
    sampleCounts,
    stats,
    closestGroups,
    recommendations: recs,
    activityFeed,
    unreadCount,
    activeFormats,
    preferredFormat,
    authUser: { firstName: authUser.firstName, subscriptionFormat: authUser.subscriptionFormat },
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  await requireNotFrozen(userId);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-state") {
    const symbol = formData.get("symbol");
    const newState = formData.get("state");
    const result = await updateCollectionState(userId, symbol, newState);
    const newMilestones = await checkMilestones(userId);
    if (newMilestones.length > 0) {
      const u = await getUserById(userId);
      for (const m of newMilestones) await notifyMilestone(userId, m, u?.email);
    }
    return json({ ok: true, result });
  }

  if (intent === "save-samples") {
    const symbol = formData.get("symbol");
    let samples = [];
    try {
      samples = JSON.parse(formData.get("samples") || "[]");
    } catch (e) {
      return json({ ok: false, error: "Invalid samples payload" }, { status: 400 });
    }
    try {
      const saved = await saveSamples(userId, symbol, samples);
      await checkMilestones(userId);
      return json({ ok: true, samples: saved });
    } catch (e) {
      return json({ ok: false, error: e.message }, { status: 400 });
    }
  }

  if (intent === "get-samples") {
    const symbol = formData.get("symbol");
    const samples = await getSamples(userId, symbol);
    return json({ ok: true, samples });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

const ACTIVITY_DOT = {
  OWNED: "bg-green-500",
  WANTED: "bg-yellow-400",
  WATCHLIST: "bg-blue-500",
};

const PRIORITY_TINT = {
  1: "bg-green-500",
  2: "bg-yellow-400",
  3: "bg-gray-400",
  4: "bg-gray-300",
};

export default function PeriodicTablePage() {
  const {
    elements, collectionStates, sampleCounts, stats, closestGroups,
    recommendations, activityFeed, unreadCount, authUser,
    activeFormats = [], preferredFormat = "",
  } = useLoaderData();

  const fetcher = useFetcher();
  const sampleFetcher = useFetcher();
  const [localStates, setLocalStates] = useState(collectionStates);
  const [localCounts, setLocalCounts] = useState(sampleCounts || {});

  const [statusEl, setStatusEl] = useState(null);   // element shown in status overlay
  const [notesEl, setNotesEl] = useState(null);      // element shown in notes modal
  const [activeSamples, setActiveSamples] = useState([]);

  // Status filter checkboxes
  const [filters, setFilters] = useState({
    OWNED: true, WANTED: true, WATCHLIST: true, MISSING: true,
  });

  // Elements carry canonical, deterministic row/col positions (standard
  // 18-column layout, lanthanides on row 9, actinides on row 10). We render
  // one cell per element at its canonical position — no Shopify-position
  // override and no overlap relocation, both of which previously produced
  // stray/duplicate cells.
  const formattedElements = useMemo(() => {
    return elements
      .map((e) => ({
        ...e,
        available: true, // Always fully visible and clickable in cabinet
      }))
      .sort((a, b) => a.z - b.z);
  }, [elements]);

  const handleCellClick = useCallback((el) => {
    setStatusEl(el);
  }, []);

  const handleSetState = useCallback((newState) => {
    if (!statusEl) return;
    const sym = statusEl.sym;
    setLocalStates((s) => {
      const next = { ...s };
      if (newState === "MISSING") delete next[sym];
      else next[sym] = newState;
      return next;
    });
    fetcher.submit({ intent: "update-state", symbol: sym, state: newState }, { method: "POST" });
  }, [statusEl, fetcher]);

  const handleEditNotes = useCallback(() => {
    if (!statusEl) return;
    setNotesEl(statusEl);
    setActiveSamples([]);
    sampleFetcher.submit({ intent: "get-samples", symbol: statusEl.sym }, { method: "POST" });
    setStatusEl(null);
  }, [statusEl, sampleFetcher]);

  // capture fetched samples
  useEffect(() => {
    if (sampleFetcher.state === "idle" && sampleFetcher.data?.ok && Array.isArray(sampleFetcher.data.samples)) {
      setActiveSamples(sampleFetcher.data.samples);
    }
  }, [sampleFetcher.state, sampleFetcher.data]);

  // when samples are saved, refresh local count for that element
  const handleSaved = useCallback((elementSym, samples) => {
    if (samples && elementSym) {
      const n = samples.length;
      setLocalCounts((c) => ({ ...c, [elementSym]: n }));
    }
  }, []);

  // Build the states map passed to the table, honoring the filter checkboxes
  const displayStates = {};
  for (const [sym, st] of Object.entries(localStates)) {
    if (filters[st]) displayStates[sym] = st;
  }

  const counts = {
    owned: stats.owned,
    wanted: stats.wanted,
    watchlist: stats.watchlist,
    missing: stats.missing,
  };

  const toggleFilter = (key) =>
    setFilters((f) => ({ ...f, [key]: !f[key] }));

  const statusForOverlay = statusEl ? (localStates[statusEl.sym] || "MISSING") : "MISSING";

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-700">
      <AppNav currentPath="/app/cabinet/periodic-table" customerName={authUser.firstName} unreadCount={unreadCount} />

      <main className="luc-main flex-1 px-8 py-7">
        <h1 className="luc-heading text-xl font-medium mb-5">Collection</h1>

        {/* Filter / control bar */}
        <section className="bg-white border border-gray-300 rounded p-4 mb-5 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              {/* Status Filters */}
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Status:</label>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none hover:text-gray-900">
                    <input type="checkbox" checked={filters.OWNED} onChange={() => toggleFilter("OWNED")} className="accent-green-500" />
                    <span className="w-2.5 h-2.5 rounded-sm bg-green-500 inline-block"></span> Owned ({counts.owned})
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none hover:text-gray-900">
                    <input type="checkbox" checked={filters.WANTED} onChange={() => toggleFilter("WANTED")} className="accent-yellow-400" />
                    <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400 inline-block"></span> Wanted ({counts.wanted})
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none hover:text-gray-900">
                    <input type="checkbox" checked={filters.WATCHLIST} onChange={() => toggleFilter("WATCHLIST")} className="accent-blue-500" />
                    <span className="w-2.5 h-2.5 rounded-sm bg-blue-500 inline-block"></span> Watchlist ({counts.watchlist})
                  </label>
                  <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer select-none hover:text-gray-900">
                    <input type="checkbox" checked={filters.MISSING} onChange={() => toggleFilter("MISSING")} className="accent-gray-400" />
                    <span className="w-2.5 h-2.5 rounded-sm bg-gray-300 inline-block"></span> Missing ({counts.missing})
                  </label>
                </div>
              </div>


            </div>

            <div className="text-sm font-semibold text-gray-700">
              {stats.owned} / {stats.cap} collected <span className="text-gray-400 font-normal">({stats.percentage}%)</span>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">
            <i className="fa-solid fa-hand-pointer mr-1"></i>Click an element to set its status and record acquisition notes. Elements with more than one specimen show a count badge.
          </p>
        </section>

        {/* Periodic table */}
        <section className="bg-white border border-gray-300 rounded p-2 md:p-5 mb-5">
          <div className={filters.MISSING ? "" : "dim-missing"}>
            <WireframePeriodicTable
              elements={formattedElements}
              states={displayStates}
              counts={localCounts}
              onCellClick={handleCellClick}
            />
          </div>
        </section>

        {/* Bottom widgets */}
        <section className="grid grid-cols-3 gap-5">
          <article className="bg-white border border-gray-300 rounded p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3"><i className="fa-solid fa-bullseye mr-1 text-gray-400"></i> Closest to Completion</h3>
            {closestGroups.length > 0 ? (
              <>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-gray-700">{closestGroups[0].groupInfo?.label || closestGroups[0].groupKey}</span>
                  <span className="text-gray-500">{closestGroups[0].owned}/{closestGroups[0].total}</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-gray-500 rounded-full" style={{ width: `${closestGroups[0].percentage}%` }}></div>
                </div>
                <p className="text-xs text-gray-400 text-right">{closestGroups[0].percentage}%</p>
              </>
            ) : (
              <p className="text-xs text-gray-400">Start collecting to see your progress.</p>
            )}
          </article>

          <article className="bg-white border border-gray-300 rounded p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3"><i className="fa-solid fa-bolt mr-1 text-gray-400"></i> Next Best Acquisitions</h3>
            {recommendations.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {recommendations.map((r) => (
                  <li key={r.element.sym} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                    <div className="w-9 h-9 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-[11px] font-semibold text-gray-600 flex-shrink-0">{r.element.sym}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-tight truncate">{r.element.name}</p>
                      <p className="text-xs text-gray-500 leading-tight truncate">{r.reason}</p>
                    </div>
                    <a href={r.link.url} target="_blank" rel="noreferrer" className="text-xs text-gray-600 hover:text-gray-800 flex-shrink-0" style={{ textDecoration: "none" }}>
                      Shop <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No recommendations yet.</p>
            )}
          </article>

          <article className="bg-white border border-gray-300 rounded p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3"><i className="fa-solid fa-clipboard-list mr-1 text-gray-400"></i> Recent Activity</h3>
            {activityFeed.length > 0 ? (
              <ul className="space-y-2 text-xs text-gray-600">
                {activityFeed.slice(0, 3).map((a, i) => {
                  let details = {};
                  try { details = JSON.parse(a.details || "{}"); } catch (e) { }
                  const dotState = (details.to || "").toUpperCase();
                  return (
                    <li key={i} className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-sm inline-block ${ACTIVITY_DOT[dotState] || "bg-gray-400"}`}></span>
                      {a.elementSymbol ? `${a.elementSymbol}: ` : ""}
                      {a.action === "state_changed" ? `${details.from || "?"} → ${details.to || "?"}` :
                        a.action === "note_saved" ? "notes updated" :
                          a.action === "milestone_earned" ? (details.title || "milestone") : a.action}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">No recent activity.</p>
            )}
          </article>
        </section>
      </main>

      {statusEl && (
        <ElementStatusOverlay
          element={statusEl}
          currentState={statusForOverlay}
          sampleCount={localCounts[statusEl.sym] || 0}
          busy={fetcher.state !== "idle"}
          onSetState={handleSetState}
          onEditNotes={handleEditNotes}
          onClose={() => setStatusEl(null)}
        />
      )}

      {notesEl && (
        <NotesModal
          key={notesEl.sym}
          element={notesEl}
          samples={activeSamples}
          formats={activeFormats}
          defaultFormat={preferredFormat}
          onClose={() => { setNotesEl(null); setActiveSamples([]); }}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
