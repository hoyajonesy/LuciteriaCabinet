/**
 * NotesModal — multi-sample acquisition notes overlay for an element.
 * Extends the collection-notes-overlay.html wireframe to support MULTIPLE
 * physical specimens ("samples") of the same element. Each sample captures
 * its own provenance (date, source, price, condition, format, notes).
 * A "+" button adds another sample; each sample can be removed.
 *
 * Props:
 *   element  — { z, sym, name } (required)
 *   samples  — array of existing sample records (may be empty)
 *   onClose  — () => void
 *   onSaved  — () => void (called after a successful save)
 */
import { useFetcher } from "@remix-run/react";
import { useEffect, useRef, useState } from "react";

const CONDITIONS = ["Mint", "Excellent", "Good", "Fair", "Damaged"];
const FORMATS = [
  { id: "", name: "—" },
  { id: "10mm", name: "10mm Cube" },
  { id: "25.4mm", name: "1-inch Cube" },
  { id: "50mm", name: "50mm Cube" },
  { id: "lucite", name: "Lucite Cube" },
  { id: "ampoules", name: "Ampoule" },
  { id: "other", name: "Other" },
];

function blankSample() {
  return {
    acquisitionDate: "",
    source: "",
    pricePaid: "",
    condition: "Mint",
    format: "",
    notes: "",
    storageLocation: "",
  };
}

function fromRecord(r) {
  return {
    acquisitionDate: r.acquisitionDate
      ? new Date(r.acquisitionDate).toISOString().slice(0, 10)
      : "",
    source: r.source || "",
    pricePaid: r.pricePaid != null ? r.pricePaid : "",
    condition: r.condition || "Mint",
    format: r.format || "",
    notes: r.notes || "",
    storageLocation: r.storageLocation || "",
  };
}

export default function NotesModal({ element, samples = [], onClose, onSaved }) {
  const fetcher = useFetcher();
  const wasSubmitting = useRef(false);

  const [rows, setRows] = useState(() =>
    samples && samples.length ? samples.map(fromRecord) : [blankSample()]
  );

  // Samples may be fetched asynchronously after the modal mounts. Re-sync the
  // editable rows once the existing samples arrive (the user has not yet had a
  // chance to edit anything because the rows are still the initial blank row).
  const syncedRef = useRef(false);
  useEffect(() => {
    if (syncedRef.current) return;
    if (samples && samples.length) {
      setRows(samples.map(fromRecord));
      syncedRef.current = true;
    }
  }, [samples]);

  useEffect(() => {
    if (fetcher.state === "submitting") wasSubmitting.current = true;
    if (fetcher.state === "idle" && wasSubmitting.current && fetcher.data?.ok) {
      wasSubmitting.current = false;
      onSaved?.(element?.sym, fetcher.data.samples || rows);
      onClose?.();
    }
  }, [fetcher.state, fetcher.data, onSaved, onClose, element, rows]);

  if (!element) return null;

  const update = (i, field, value) =>
    setRows((rs) => rs.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  const addRow = () => setRows((rs) => [...rs, blankSample()]);
  const removeRow = (i) => setRows((rs) => (rs.length <= 1 ? rs : rs.filter((_, idx) => idx !== i)));

  const handleSave = () => {
    fetcher.submit(
      { intent: "save-samples", symbol: element.sym, samples: JSON.stringify(rows) },
      { method: "POST" }
    );
  };

  const saving = fetcher.state !== "idle";

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 flex items-start justify-center pt-16 pb-16 overflow-y-auto"
      style={{ zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="w-[640px] max-w-[94vw] bg-white rounded-lg border border-gray-300 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <header className="flex items-center gap-3 px-5 py-4 border-b border-gray-200">
          <div className="w-11 h-11 rounded border-2 border-gray-500 flex flex-col items-center justify-center flex-shrink-0 relative">
            <span className="absolute top-0.5 left-1 text-[8px] text-gray-400">{element.z}</span>
            <span className="text-base font-semibold text-gray-700 leading-none">{element.sym}</span>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-800 leading-tight">{element.sym} &middot; {element.name}</p>
            <p className="text-xs text-gray-500 leading-tight">
              {rows.length} sample{rows.length === 1 ? "" : "s"} &middot;{" "}
              <span className="inline-flex items-center gap-1">
                <span className="w-2 h-2 rounded-sm bg-green-500 inline-block"></span> Owned
              </span>
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded hover:bg-gray-100 text-gray-400 flex items-center justify-center"
            style={{ background: "none", border: "none", cursor: "pointer" }}
          >
            <i className="fa-solid fa-xmark"></i>
          </button>
        </header>

        {/* Body — one block per sample */}
        <div className="px-5 py-5 space-y-4 max-h-[55vh] overflow-y-auto">
          {rows.map((row, i) => (
            <div key={i} className="border border-gray-200 rounded p-4 relative">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-gray-600">
                  <i className="fa-solid fa-cube mr-1 text-gray-400"></i> Sample {i + 1}
                </p>
                {rows.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeRow(i)}
                    className="text-xs text-gray-400 hover:text-red-500"
                    style={{ background: "none", border: "none", cursor: "pointer" }}
                  >
                    <i className="fa-solid fa-trash-can mr-1"></i> Remove
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Acquisition Date</label>
                  <input
                    type="date"
                    value={row.acquisitionDate}
                    onChange={(e) => update(i, "acquisitionDate", e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Source</label>
                  <input
                    type="text"
                    value={row.source}
                    onChange={(e) => update(i, "source", e.target.value)}
                    placeholder="e.g. Luciteria, eBay seller"
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Price Paid</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-sm text-gray-400">$</span>
                    <input
                      type="text"
                      value={row.pricePaid}
                      onChange={(e) => update(i, "pricePaid", e.target.value)}
                      className="w-full border border-gray-300 rounded pl-7 pr-3 py-2 text-sm text-gray-700"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Condition</label>
                  <div className="relative">
                    <select
                      value={row.condition}
                      onChange={(e) => update(i, "condition", e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 bg-white appearance-none pr-8"
                    >
                      {CONDITIONS.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-3 text-xs text-gray-400"></i>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1.5">Format</label>
                  <div className="relative">
                    <select
                      value={row.format}
                      onChange={(e) => update(i, "format", e.target.value)}
                      className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 bg-white appearance-none pr-8"
                    >
                      {FORMATS.map((f) => (
                        <option key={f.id} value={f.id}>{f.name}</option>
                      ))}
                    </select>
                    <i className="fa-solid fa-chevron-down pointer-events-none absolute right-3 top-3 text-xs text-gray-400"></i>
                  </div>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Storage Location</label>
                <input
                  type="text"
                  value={row.storageLocation || ""}
                  onChange={(e) => update(i, "storageLocation", e.target.value)}
                  placeholder="e.g. Display case, Drawer 3"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Private Notes</label>
                <textarea
                  rows="2"
                  value={row.notes}
                  onChange={(e) => update(i, "notes", e.target.value)}
                  placeholder="Provenance, packaging, serial number, etc."
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 resize-none"
                ></textarea>
              </div>
            </div>
          ))}

          <button
            type="button"
            onClick={addRow}
            className="w-full border border-dashed border-gray-300 rounded py-2.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
            style={{ background: "none", cursor: "pointer" }}
          >
            <i className="fa-solid fa-plus mr-1.5"></i> Add another sample
          </button>

          <p className="text-[11px] text-gray-400">
            <i className="fa-solid fa-lock mr-1"></i> Notes are private and only visible to you.
          </p>
        </div>

        {/* Footer */}
        <footer className="flex items-center justify-end gap-3 px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded bg-white hover:bg-gray-100"
            style={{ cursor: "pointer" }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium text-white bg-gray-700 rounded hover:bg-gray-800"
            style={{ cursor: "pointer", border: "none" }}
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </footer>
      </div>
    </div>
  );
}
