/**
 * Subscription Owned-Items Onboarding (FR-9/10/11/12)
 *
 * Magic-link landing page where a new subscriber confirms which elements they
 * already own in their subscription's format track. Reuses the wireframe
 * periodic-table picker. Order-history suggestions are pre-selected; anything
 * the subscriber leaves unselected among the suggestions is recorded as an
 * explicit rejection (FR-4).
 *
 * Route: /onboarding/subscription/:token?contract=<contractId>
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState, useMemo } from "react";
import { prisma } from "../lib/db.server.js";
import { getUserByOnboardingToken, invalidateOnboardingToken } from "../lib/auth.server.js";
import { getFeatureFlag } from "../lib/feature-flags.server.js";
import {
  getOnboardingByContract,
  completeOnboarding,
  ONBOARDING_STATUS,
} from "../lib/subscription-onboarding.server.js";
import { ELEMENTS_118 } from "../data/elements.server.js";
import { normaliseFormat, formatLabel } from "../lib/formats.js";
import { ElementPickerGrid } from "../components/ElementPickerModal";
// NOTE: WireframePeriodicTable was the original onboarding picker. Per FR-11 the
// onboarding UI now reuses the Passport search/filter/multi-select foundation
// (ElementPickerGrid) instead — no five-item cap, no fixed periodic-table order.
// The periodic-table component remains available for other views.
// eslint-disable-next-line no-unused-vars
import WireframePeriodicTable from "../components/WireframePeriodicTable";

export const loader = async ({ request, params }) => {
  const url = new URL(request.url);
  const contractId = url.searchParams.get("contract") || "";
  const token = params.token;

  // Feature must be enabled.
  const enabled = await getFeatureFlag("feature_subscription_onboarding_gate");
  if (!enabled) {
    return json({ status: "disabled" });
  }

  // Validate the magic link (single-use, time-limited, contract-bound, not frozen).
  const user = await getUserByOnboardingToken(token, contractId);
  if (!user) {
    return json({ status: "invalid" });
  }

  const onboarding = await getOnboardingByContract(contractId);
  if (!onboarding || onboarding.userId !== user.id) {
    return json({ status: "invalid" });
  }
  if (onboarding.status === ONBOARDING_STATUS.COMPLETE) {
    return json({ status: "complete", userName: user.firstName });
  }

  const canonicalFormat = normaliseFormat(onboarding.formatTrack) || onboarding.formatTrack;

  // Existing suggestions seeded from order history (pre-select these).
  const suggestions = await prisma.collectionItem.findMany({
    where: {
      userId: user.id,
      sourceSubscriptionContractId: contractId,
      format: canonicalFormat,
      rejectedBySubscriber: false,
    },
    select: { elementSymbol: true, state: true, ownershipSource: true },
  });

  const suggestedSymbols = suggestions.map((s) => s.elementSymbol);

  const elements = ELEMENTS_118.map((e) => ({
    z: e.z, sym: e.sym, name: e.name,
    row: e.row, col: e.col, group: e.group, phase: e.phase,
  }));

  return json({
    status: "pending",
    userName: user.firstName,
    contractId,
    token,
    formatTrack: onboarding.formatTrack,
    canonicalFormat,
    formatLabel: formatLabel(onboarding.formatTrack) || onboarding.formatTrack,
    suggestedSymbols,
    elements,
  });
};

export const action = async ({ request, params }) => {
  const formData = await request.formData();
  const contractId = formData.get("contractId") || "";
  const token = params.token;

  const enabled = await getFeatureFlag("feature_subscription_onboarding_gate");
  if (!enabled) return redirect("/");

  const user = await getUserByOnboardingToken(token, contractId);
  if (!user) {
    return json({ ok: false, error: "This link is invalid or has expired." }, { status: 400 });
  }

  const onboarding = await getOnboardingByContract(contractId);
  if (!onboarding || onboarding.userId !== user.id) {
    return json({ ok: false, error: "This link is invalid or has expired." }, { status: 400 });
  }

  const canonicalFormat = normaliseFormat(onboarding.formatTrack) || onboarding.formatTrack;

  const confirmedSymbols = String(formData.get("confirmedSymbols") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);
  const suggestedSymbols = String(formData.get("suggestedSymbols") || "")
    .split(",").map((s) => s.trim()).filter(Boolean);

  // Confirmations = everything the subscriber selected.
  const confirmations = confirmedSymbols.map((elementSymbol) => ({
    elementSymbol,
    format: canonicalFormat,
  }));

  // Rejections = suggested items the subscriber did NOT keep selected (FR-4).
  const confirmedSet = new Set(confirmedSymbols.map((s) => s.toLowerCase()));
  const rejections = suggestedSymbols
    .filter((sym) => !confirmedSet.has(sym.toLowerCase()))
    .map((elementSymbol) => ({ elementSymbol, format: canonicalFormat }));

  await completeOnboarding({
    userId: user.id,
    contractId,
    confirmations,
    rejections,
  });

  // Single-use: burn the token now that onboarding is complete (FR-12).
  await invalidateOnboardingToken(user.id);

  return redirect(`/onboarding/subscription/${token}?contract=${encodeURIComponent(contractId)}&done=1`);
};

export default function SubscriptionOnboarding() {
  const data = useLoaderData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  // Non-pending states render a simple message card.
  if (data.status !== "pending") {
    let title = "Subscription onboarding";
    let message = "This page isn't available.";
    if (data.status === "complete") {
      title = "You're all set 🎉";
      message = "Thanks — we've recorded the elements you already own. Future shipments will avoid sending duplicates.";
    } else if (data.status === "invalid") {
      title = "Link expired or invalid";
      message = "This onboarding link is no longer valid. If you still need to confirm your collection, please contact support and we'll send a fresh link.";
    } else if (data.status === "disabled") {
      title = "Not available";
      message = "This feature isn't currently enabled.";
    }
    return (
      <main className="min-h-screen bg-luc-gray flex items-center justify-center py-12 px-4 font-sans text-luc-text">
        <section className="w-full max-w-lg bg-white border border-luc-border rounded-card shadow-card p-8 text-center">
          <h1 className="luc-heading text-2xl font-medium mb-3">{title}</h1>
          <p className="text-base text-gray-500">{message}</p>
        </section>
      </main>
    );
  }

  const { userName, formatLabel: fmtLabel, suggestedSymbols, elements, contractId } = data;

  // Pre-select suggestions from order history (FR-12).
  const [owned, setOwned] = useState(() => new Set(suggestedSymbols));
  const [search, setSearch] = useState("");

  // Adapt ELEMENTS_118 to the shared picker's item shape. There is NO selection
  // cap here (FR-11) and no fixed periodic-table ordering.
  const pickerItems = useMemo(
    () => elements.map((el) => ({ uid: el.sym, symbol: el.sym, name: el.name })),
    [elements]
  );

  const suggestedSet = useMemo(() => new Set(suggestedSymbols), [suggestedSymbols]);

  const toggle = (el) => {
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(el.symbol)) next.delete(el.symbol);
      else next.add(el.symbol);
      return next;
    });
  };

  const ownedCount = owned.size;

  return (
    <main className="min-h-screen bg-luc-gray flex items-center justify-center py-8 md:py-12 px-2 md:px-4 font-sans text-luc-text">
      <section className="w-full max-w-[1180px] bg-white border border-luc-border rounded-card shadow-card p-3 md:p-8">
        <div className="flex items-start justify-between mb-1">
          <h1 className="luc-heading text-2xl font-medium">
            Confirm your collection{userName ? `, ${userName}` : ""}
          </h1>
          <span className="inline-block text-sm font-semibold text-gray-700 border border-gray-300 rounded px-3 py-1.5 bg-gray-50 flex-shrink-0">
            {ownedCount} element{ownedCount !== 1 ? "s" : ""} selected
          </span>
        </div>
        <p className="text-base text-gray-500 mb-6">
          Tell us which <strong>{fmtLabel}</strong> elements you already own so we
          never ship you a duplicate. We've pre-selected items from your order
          history — deselect any you don't actually have.
        </p>

        {suggestedSymbols.length > 0 && (
          <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 flex items-start gap-2">
            <i className="fa-solid fa-circle-info mt-0.5"></i>
            <span>
              {suggestedSymbols.length} element{suggestedSymbols.length !== 1 ? "s" : ""} from your
              past orders {suggestedSymbols.length !== 1 ? "are" : "is"} pre-selected. Deselecting one
              tells us you no longer (or never did) own it.
            </span>
          </div>
        )}

        <section className="bg-gray-50 border border-gray-200 rounded p-3 md:p-4 mb-7">
          <ElementPickerGrid
            items={pickerItems}
            isSelected={(el) => owned.has(el.symbol)}
            onToggle={toggle}
            search={search}
            onSearchChange={setSearch}
            maxSelectable={null}
            selectedCount={ownedCount}
            isSuggested={(el) => suggestedSet.has(el.symbol)}
            emptyText="No elements are available for this track yet."
            noMatchText={`No elements match "${search}".`}
            searchPlaceholder="Search by element name or symbol…"
          />
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-200">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <i className="fa-solid fa-circle-check text-luc-blue" /> Owned (selected)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                <i className="fa-solid fa-wand-magic-sparkles mr-1" />Suggested
              </span>
              from your order history
            </span>
          </div>
        </section>

        <Form method="post">
          <input type="hidden" name="contractId" value={contractId} />
          <input type="hidden" name="confirmedSymbols" value={Array.from(owned).join(",")} />
          <input type="hidden" name="suggestedSymbols" value={suggestedSymbols.join(",")} />
          <div className="flex items-center justify-end border-t border-gray-200 pt-6">
            <button type="submit" disabled={isSubmitting} className="btn-primary disabled:opacity-60">
              {isSubmitting ? "Saving…" : "Confirm my collection →"}
            </button>
          </div>
        </Form>
      </section>
    </main>
  );
}
