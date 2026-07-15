/**
 * Collector Cabinet Dashboard — Collection-First (Phase 1 Refactor)
 * 
 * The primary view: periodic table front-and-center with collection progress.
 * Shows:
 * - Interactive periodic table with state toggling (Owned/Wanted/Watchlist/Missing)
 * - Collection stats (owned, wanted, watchlist, missing)
 * - Progress by group (closest to completion)
 * - Next best recommendation
 * - Recent milestones
 * - Activity feed
 * 
 * Subscription features preserved but moved to background.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import AppNav from "../components/AppNav";

import { ELEMENTS_118, isAvailableForCollection, isPreciousMetal } from "../data/elements.server";
import { getUserId } from "../lib/session.server";
import { getUserById, updateUser } from "../lib/auth.server";
import { checkFrozenStatus, requireNotFrozen } from "../lib/frozen-guard.server";
import FrozenBanner from "../components/FrozenBanner";
import {
  getCollectionStats,
  getClosestToCompletion,
  getNextBestRecommendations,
  getActivityFeed,
  updateCollectionState,
  getUserCollectionByState,
} from "../lib/collection.server";
import { checkMilestones, getUserMilestones } from "../lib/milestones.server";
import { getInvestmentSummaryFromSamples } from "../lib/samples.server";
import { notifyMilestone, getUnreadCount } from "../lib/notifications-db.server";

export const loader = async ({ request }) => {
  const { getProductLinkWithFallback } = await import("../data/product-links.server");
  const userId = await getUserId(request);
  let authUser = null;
  if (userId) {
    authUser = await getUserById(userId);
    if (authUser && !authUser.onboardingCompleted) {
      const stepRoutes = {
        1: "/onboarding/welcome",
        2: "/onboarding/collection-goal",
        3: "/onboarding/log-owned",
        4: "/onboarding/complete",
      };
      return redirect(stepRoutes[authUser.onboardingStep] || "/onboarding/welcome");
    }
  }
  if (!authUser) {
    return redirect("/onboarding/welcome");
  }

  const ct = authUser.subscriptionFormat || "lucite";

  // Get collection data from the new service layer
  const stats = await getCollectionStats(userId, ct);
  const closestGroups = await getClosestToCompletion(userId);
  const recommendationList = await getNextBestRecommendations(userId, 3, ct);
  const milestoneData = await getUserMilestones(userId);
  const activityFeed = await getActivityFeed(userId, 10);
  const investment = await getInvestmentSummaryFromSamples(userId);
  const unreadCount = await getUnreadCount(userId);

  // Map each WANTED (wishlist) element to the collector saved for it,
  // so the dashboard Shop link points at that exact format.
  const wantedItems = await getUserCollectionByState(userId, "WANTED");
  const wishlistItemsBySym = new Map(wantedItems.map(it => [it.elementSymbol, it]));

  const recommendations = recommendationList.map((r) => {
    const wishlistItem = wishlistItemsBySym.get(r.element.sym);
    let link = null;

    if (wishlistItem) {
      const el = ELEMENTS_118.find((e) => e.sym === r.element.sym);
      let variant = null;
      const preferredFormat = wishlistItem.format || ct;

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
      const preferredFormat = wishlistItem?.format || ct;
      link = getProductLinkWithFallback(r.element.sym, preferredFormat, r.element.name);
    }

    return {
      element: { z: r.element.z, sym: r.element.sym, name: r.element.name },
      reason: r.reason,
      link,
    };
  });

  // Build collection states map for the periodic table
  const collectionStates = {};
  for (const sym of stats.ownedSymbols) collectionStates[sym] = "OWNED";
  for (const sym of stats.wantedSymbols) collectionStates[sym] = "WANTED";
  for (const sym of stats.watchlistSymbols) collectionStates[sym] = "WATCHLIST";

  // Serialize elements for client
  const elements = ELEMENTS_118.map(e => ({
    z: e.z, sym: e.sym, name: e.name,
    row: e.row, col: e.col, group: e.group, phase: e.phase,
    available: isAvailableForCollection(e.z, ct),
    precious: isPreciousMetal(e.sym),
  }));

  return json({
    elements,
    collectionStates,
    collectionType: ct,
    stats,
    closestGroups,
    recommendations,
    milestones: milestoneData.milestones.filter(m => m.isEarned).slice(0, 5),
    totalMilestones: milestoneData.totalEarned,
    possibleMilestones: milestoneData.totalPossible,
    activityFeed,
    investment,
    unreadCount,
    isFrozen: (await checkFrozenStatus(userId)).isFrozen,
    authUser: {
      id: authUser.id,
      firstName: authUser.firstName,
      lastName: authUser.lastName,
      isSubscriber: authUser.isSubscriber,
      userType: authUser.userType,
    },
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  await requireNotFrozen(userId);

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-state") {
    const symbol = formData.get("symbol");
    const newState = formData.get("state");
    const result = await updateCollectionState(userId, symbol, newState);
    // Check milestones after state change
    const newMilestones = await checkMilestones(userId);
    // Phase 2D: create in-app notifications for any newly earned milestones
    if (newMilestones.length > 0) {
      const u = await getUserById(userId);
      for (const m of newMilestones) {
        await notifyMilestone(userId, m, u?.email);
      }
    }
    return json({ ok: true, result, newMilestones });
  }

  if (intent === "dismiss-tooltips") {
    await updateUser(userId, { tooltipsDismissed: true });
    return json({ ok: true });
  }

  return json({ error: "Unknown intent" }, { status: 400 });
};

function CompletionRing({ percentage }) {
  const pct = Math.max(0, Math.min(100, percentage || 0));
  return (
    <div
      className="w-24 h-24 rounded-full flex items-center justify-center relative mb-3"
      style={{
        background: `conic-gradient(#6b7280 ${pct * 3.6}deg, #e5e7eb 0deg)`,
      }}
    >
      <div className="absolute inset-[6px] rounded-full bg-white flex items-center justify-center">
        <span className="text-lg font-semibold text-gray-800">{pct}%</span>
      </div>
    </div>
  );
}

const MILESTONE_ICONS = ["fa-trophy", "fa-medal", "fa-star"];

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const then = new Date(dateStr).getTime();
  const days = Math.floor((Date.now() - then) / 86400000);
  if (days <= 0) return "Unlocked today";
  if (days === 1) return "Unlocked yesterday";
  if (days < 7) return `Unlocked ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "Unlocked 1 week ago";
  if (weeks < 5) return `Unlocked ${weeks} weeks ago`;
  return `Unlocked ${Math.floor(days / 30)} month(s) ago`;
}

export default function CabinetDashboard() {
  const {
    stats, closestGroups, recommendations, milestones,
    investment, unreadCount, authUser, isFrozen,
  } = useLoaderData();

  const fullName = authUser.firstName || "Collector";

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-700">
      <AppNav
        currentPath="/app/cabinet"
        customerName={fullName}
        unreadCount={unreadCount}
      />

      <main className="luc-main flex-1 px-4 py-5 sm:px-8 sm:py-8">
        <FrozenBanner show={isFrozen} />
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-6">
          <div>
            <h1 className="luc-heading text-xl font-medium">Welcome back, {fullName}</h1>
            <p className="text-sm text-gray-500">Here's how your collection is coming along.</p>
          </div>
          <Link
            to="/app/cabinet/periodic-table"
            className="text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white rounded-btn px-5 py-2.5 text-center whitespace-nowrap"
            style={{ textDecoration: "none" }}
          >
            <i className="fa-solid fa-plus mr-1"></i> Log Acquisition
          </Link>
        </div>

        {/* Top stat row */}
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-5 mb-6">
          {/* Overall completion ring */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5 flex flex-col items-center justify-center">
            <CompletionRing percentage={stats.percentage} />
            <p className="text-sm font-medium text-gray-700">Overall</p>
            <p className="text-xs text-gray-500">{stats.owned} of {stats.cap} elements</p>
          </article>

          {/* Owned */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5">
            <div className="w-9 h-9 rounded bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-500 mb-3">
              <i className="fa-solid fa-cube"></i>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Owned</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-800">{stats.owned}</p>
            <p className="text-xs text-gray-500 mt-1">in your collection</p>
          </article>

          {/* On Wishlist (WANTED) */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5">
            <div className="w-9 h-9 rounded bg-gray-100 border border-gray-300 flex items-center justify-center text-yellow-500 mb-3">
              <i className="fa-solid fa-heart"></i>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400">On Wishlist</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-800">{stats.wanted}</p>
            <p className="text-xs text-gray-500 mt-1">elements wanted</p>
          </article>

          {/* Watching (WATCHLIST) */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5">
            <div className="w-9 h-9 rounded bg-gray-100 border border-gray-300 flex items-center justify-center text-blue-500 mb-3">
              <i className="fa-solid fa-eye"></i>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Watching</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-800">{stats.watchlist}</p>
            <p className="text-xs text-gray-500 mt-1">on your watchlist</p>
          </article>

          {/* Total Invested */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5">
            <div className="w-9 h-9 rounded bg-gray-100 border border-gray-300 flex items-center justify-center text-gray-500 mb-3">
              <i className="fa-solid fa-wallet"></i>
            </div>
            <p className="text-xs uppercase tracking-wide text-gray-400">Total Invested</p>
            <p className="text-xl sm:text-2xl font-semibold text-gray-800">
              ${investment.totalInvested.toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              across {investment.itemsWithPrice} sample{investment.itemsWithPrice !== 1 ? "s" : ""}
            </p>
          </article>
        </section>

        {/* Two-column widgets */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 mb-6">
          {/* Closest to completion */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5">
            <h2 className="luc-heading text-sm font-medium mb-4">Closest to Completion</h2>
            {closestGroups.length === 0 ? (
              <p className="text-xs text-gray-400">Start collecting to see your closest groups.</p>
            ) : (
              <div className="space-y-4">
                {closestGroups.slice(0, 3).map((group, i) => (
                  <div key={i}>
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>{group.groupInfo?.label || group.groupKey}</span>
                      <span>{group.owned} / {group.total}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-200 rounded-full">
                      <div className="h-2 bg-gray-500 rounded-full" style={{ width: `${group.percentage}%` }}></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          {/* Next best acquisitions */}
          <article className="bg-white border border-gray-300 rounded p-4 sm:p-5">
            <h2 className="luc-heading text-sm font-medium mb-4">Next Best Acquisitions</h2>
            {recommendations && recommendations.length > 0 ? (
              <ul className="divide-y divide-gray-100">
                {recommendations.map((r) => (
                  <li key={r.element.sym} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                    <div className="w-10 h-10 bg-gray-100 border border-gray-300 rounded flex items-center justify-center text-xs font-semibold text-gray-600 flex-shrink-0">
                      {r.element.sym}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-800 leading-tight truncate">{r.element.name}</p>
                      <p className="text-xs text-gray-500 leading-tight truncate">{r.reason}</p>
                    </div>
                    <a href={r.link.url} target="_blank" rel="noreferrer" className="text-sm text-gray-600 hover:text-gray-800 flex-shrink-0" style={{ textDecoration: "none" }}>
                      Shop <i className="fa-solid fa-arrow-right text-[10px]"></i>
                    </a>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-gray-400">Collect your first element to get recommendations.</p>
            )}
          </article>
        </section>

        {/* Recent milestones */}
        <section className="bg-white border border-gray-300 rounded p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="luc-heading text-sm font-medium">Recent Milestones</h2>
            <Link to="/app/cabinet/notifications" className="text-xs text-gray-500" style={{ textDecoration: "none" }}>View all</Link>
          </div>
          {milestones.length === 0 ? (
            <p className="text-xs text-gray-400">Earn milestones by growing your collection.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {milestones.slice(0, 3).map((m, i) => (
                <div key={i} className="border border-gray-200 rounded p-4 flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gray-200 border border-gray-300 flex items-center justify-center text-gray-500">
                    <i className={`fa-solid ${MILESTONE_ICONS[i % MILESTONE_ICONS.length]}`}></i>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{m.title}</p>
                    <p className="text-xs text-gray-500">{m.earnedAt ? timeAgo(m.earnedAt) : m.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
