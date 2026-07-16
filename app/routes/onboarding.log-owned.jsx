/**
 * Onboarding Step 3 of 4 — What Do You Already Own?
 *
 * Users pick the format they like to collect (admin-managed format list),
 * then click elements on a simple periodic table to mark the ones they
 * already own. No Owned/Wanted/Watchlist/Missing states — a single
 * "owned" toggle keeps onboarding fast. They can skip entirely.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState, useMemo } from "react";
import { getUserId } from "../lib/session.server";
import { getUserById, updateUser } from "../lib/auth.server";
import { bulkSetOwned } from "../lib/collection.server";
import { checkMilestones } from "../lib/milestones.server";
import { notifyMilestone } from "../lib/notifications-db.server";
import { ELEMENTS_118 } from "../data/elements.server";
import { FORMAT_LIST } from "../lib/formats";
import WireframePeriodicTable from "../components/WireframePeriodicTable";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");
  if (user.onboardingCompleted) return redirect("/app/cabinet");

  // Include size (periodic_size metafield) so client can filter per format
  const elements = ELEMENTS_118.map(e => ({
    z: e.z, sym: e.sym, name: e.name,
    row: e.row, col: e.col, group: e.group, phase: e.phase,
    size: e.size,
    productsByFormat: e.productsByFormat || {},
  }));

  // Since FORMATS key === id, formatKey === id - pass directly.
  const formats = FORMAT_LIST.map(f => ({
    id: f.id, name: f.name, icon: f.icon,
    formatKey: f.id,
    description: f.description || "",
  }));

  return json({ userName: user.firstName, elements, formats });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const formData = await request.formData();
  const ownedSymbols = formData.get("ownedSymbols");
  const selectedFormat = formData.get("selectedFormat") || "other";
  const symbols = ownedSymbols ? ownedSymbols.split(",").filter(Boolean) : [];

  if (symbols.length > 0) {
    await bulkSetOwned(userId, symbols, selectedFormat);
    const newMilestones = await checkMilestones(userId);
    if (newMilestones.length > 0) {
      const u = await getUserById(userId);
      for (const m of newMilestones) {
        await notifyMilestone(userId, m, u?.email);
      }
    }
  }

  // Save the selected format to user's profile and advance to final step
  await updateUser(userId, { onboardingStep: 4, subscriptionFormat: selectedFormat });
  return redirect("/onboarding/complete");
};

export default function LogOwnedStep() {
  const { userName, elements, formats } = useLoaderData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [owned, setOwned] = useState(() => new Set());
  const [selectedFormat, setSelectedFormat] = useState("");
  const [showTooltip, setShowTooltip] = useState(false);

  // Show the FULL periodic table (all 118 elements). We intentionally do NOT
  // filter by what Luciteria sells in the chosen format — collectors may own
  // specimens bought elsewhere or previously acquired. Once a format is
  // selected every element becomes selectable; before that, nothing is.
  const visibleElements = useMemo(() => {
    return elements.map((el) => ({
      ...el,
      elementName: el.elementName || el.name,
      available: selectedFormat !== "",
    }));
  }, [elements, selectedFormat]);

  const toggle = (el) => {
    if (selectedFormat === "") return;
    setOwned((prev) => {
      const next = new Set(prev);
      if (next.has(el.sym)) next.delete(el.sym);
      else next.add(el.sym);
      return next;
    });
  };

  const states = useMemo(() => {
    const s = {};
    owned.forEach((sym) => { s[sym] = "OWNED"; });
    return s;
  }, [owned]);

  const ownedCount = owned.size;
  const isFormatLocked = ownedCount > 0;

  return (
    <main className="min-h-screen bg-luc-gray flex items-center justify-center py-8 md:py-12 px-2 md:px-4 font-sans text-luc-text">
      <section className="w-full max-w-[1180px] bg-white border border-luc-border rounded-card shadow-card p-3 md:p-8">
        {/* Step indicator */}
        <div className="flex items-center justify-between mb-6">
          <span className="inline-block text-sm text-gray-500 border border-gray-300 rounded px-3 py-1 bg-gray-50">
            Step 3 of 3
          </span>
          <div className="flex gap-1">
            <span className="w-8 h-1.5 bg-luc-blue rounded" />
            <span className="w-8 h-1.5 bg-luc-blue rounded" />
            <span className="w-8 h-1.5 bg-luc-blue rounded" />
          </div>
        </div>

        {/* Heading + counter */}
        <div className="flex items-start justify-between mb-1">
          <h1 className="luc-heading text-2xl font-medium">
            Log your existing collection{userName ? `, ${userName}` : ""}
          </h1>
          <span className="inline-block text-sm font-semibold text-gray-700 border border-gray-300 rounded px-3 py-1.5 bg-gray-50 flex-shrink-0">
            {ownedCount} element{ownedCount !== 1 ? "s" : ""} selected
          </span>
        </div>
        <p className="text-base text-gray-500 mb-6">
          Click elements you already own. Don't worry, you can add more later.
        </p>

        {/* Format Selector Card - Step 1 */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-5 mb-5 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
              <i className="fa-solid fa-filter text-lg"></i>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Step 1: Choose Your Preferred Format</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Collection Format:</label>
            <div className="relative">
              <select
                value={selectedFormat}
                onChange={(e) => setSelectedFormat(e.target.value)}
                disabled={isFormatLocked}
                onMouseEnter={() => isFormatLocked && setShowTooltip(true)}
                onMouseLeave={() => setShowTooltip(false)}
                className={`border-2 rounded-lg px-4 py-2.5 text-sm text-gray-700 bg-white appearance-none pr-10 w-[200px] font-medium shadow-sm transition-colors ${isFormatLocked
                  ? 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-60'
                  : 'border-blue-300 hover:border-blue-400'
                  }`}
              >
                <option value="" disabled>Select a format...</option>
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <i className={`fa-solid ${isFormatLocked ? 'fa-lock' : 'fa-chevron-down'} absolute right-4 top-3.5 text-sm ${isFormatLocked ? 'text-gray-500' : 'text-blue-600'} pointer-events-none`}></i>
              {showTooltip && isFormatLocked && (
                <div className="absolute top-full left-0 mt-2 bg-gray-800 text-white text-xs rounded px-3 py-2 shadow-lg whitespace-nowrap z-10">
                  Deselect all elements to change format
                  <div className="absolute -top-1 left-4 w-2 h-2 bg-gray-800 transform rotate-45"></div>
                </div>
              )}
            </div>
            {isFormatLocked && (
              <span className="text-xs text-gray-600 flex items-center gap-1">
                <i className="fa-solid fa-info-circle text-blue-500"></i>
                Format locked — deselect all elements to change
              </span>
            )}
          </div>
        </section>

        {/* Step 2 Helper Text */}
        <div className="mb-3">
          <p className="text-sm text-gray-700 flex items-center gap-2 font-medium">
            <i className="fa-solid fa-hand-pointer text-blue-500"></i>
            Step 2: Select elements you own
          </p>
          <p className="text-xs text-gray-400 mt-1 ml-6">
            Click any element to add it to your collection. Green border = owned.
          </p>
        </div>

        {/* Periodic table */}
        <section className="bg-gray-50 border border-gray-200 rounded p-1.5 md:p-4 mb-7 relative">
          <div key={selectedFormat} className="onb-ptable overflow-x-auto">
            <WireframePeriodicTable
              elements={visibleElements}
              states={states}
              showChecks
              onCellClick={toggle}
            />
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-4 pt-3 border-t border-gray-200">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm border-2 border-green-500 inline-block" /> Owned (selected)
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-3 h-3 rounded-sm border border-gray-300 inline-block" /> Not yet added
            </span>
          </div>
        </section>

        {/* Bottom buttons */}
        <Form method="post">
          <input type="hidden" name="ownedSymbols" value={Array.from(owned).join(",")} />
          <input type="hidden" name="selectedFormat" value={selectedFormat} />
          <div className="flex items-center justify-between border-t border-gray-200 pt-6">
            <button
              type="submit"
              name="skip"
              value="1"
              disabled={isSubmitting}
              onClick={() => setOwned(new Set())}
              className="text-sm text-gray-500 border border-gray-300 rounded px-5 py-2.5 bg-white hover:bg-gray-50"
            >
              Skip for Now
            </button>
            <button
              type="submit"
              disabled={isSubmitting || selectedFormat === ""}
              className="btn-primary disabled:opacity-60"
            >
              {isSubmitting ? "Saving…" : "Continue →"}
            </button>
          </div>
        </Form>
      </section>
    </main>
  );
}
