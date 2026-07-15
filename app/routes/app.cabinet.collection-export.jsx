/**
 * Resource route — CSV export of the collector's owned-element ledger.
 *
 * Flattened: one row per physical sample (with element columns repeated).
 * This route has NO default component export, so Remix treats it as a pure
 * resource route and streams the CSV Response directly. The Summary screen
 * links here via an `<a download>` element.
 */
import { redirect } from "@remix-run/node";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { prisma } from "../lib/db.server";

const DATE_NUMERIC = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function fmtDateNumeric(d) {
  if (!d) return "";
  const dt = d instanceof Date ? d : new Date(d);
  if (isNaN(dt.getTime())) return "";
  return DATE_NUMERIC.format(dt);
}

function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function noteToSample(note, fallbackFormat) {
  return {
    acquisitionDate: note.acquisitionDate,
    source: note.source,
    pricePaid: note.pricePaid,
    currency: note.currency || "USD",
    condition: note.condition,
    format: fallbackFormat || null,
    storageLocation: note.storageLocation,
    notes: note.notes,
  };
}

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  const items = await prisma.collectionItem.findMany({
    where: { userId, state: "OWNED" },
    include: { samples: true, elementNote: true },
    orderBy: { elementName: "asc" },
  });

  const headers = [
    "Element Name", "Symbol", "Atomic #", "Format", "Condition",
    "Acquisition Date", "Source", "Price Paid", "Currency", "Storage Location", "Notes",
  ];
  const lines = [headers.join(",")];

  for (const item of items) {
    const rawSamples =
      item.samples && item.samples.length
        ? item.samples
        : item.elementNote
        ? [noteToSample(item.elementNote, item.format)]
        : [null];
    for (const s of rawSamples) {
      lines.push(
        [
          item.elementName,
          item.elementSymbol,
          item.atomicNumber,
          s ? s.format || "" : "",
          s ? s.condition || "" : "",
          s ? fmtDateNumeric(s.acquisitionDate) : "",
          s ? s.source || "" : "",
          s && s.pricePaid != null ? s.pricePaid : "",
          s ? s.currency || "" : "",
          s ? s.storageLocation || "" : "",
          s ? s.notes || "" : "",
        ].map(csvCell).join(",")
      );
    }
  }

  const csv = lines.join("\n");
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date()); // YYYY-MM-DD
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="luciteria-collection-${today}.csv"`,
    },
  });
};
