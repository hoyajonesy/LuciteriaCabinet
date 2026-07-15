/**
 * ElementStatusOverlay — opens when a collector clicks an element on the
 * Collection page. Shows the element's current status and lets the user set
 * it to Owned / Wanted / Watchlist / Missing, then add or edit acquisition
 * notes (which open the multi-sample NotesModal).
 *
 * Gray/white wireframe visual language (matches collection-notes-overlay.html).
 *
 * Props:
 *   element      — { z, sym, name } (required)
 *   currentState — "OWNED" | "WANTED" | "WATCHLIST" | "MISSING"
 *   sampleCount  — number of saved samples for this element
 *   busy         — boolean (state change in flight)
 *   onSetState   — (state) => void
 *   onEditNotes  — () => void
 *   onClose      — () => void
 */

const STATUS = [
  { id: "OWNED", label: "Owned", dot: "bg-green-500", icon: "fa-circle-check" },
  { id: "WANTED", label: "Wanted (Wishlist)", dot: "bg-yellow-400", icon: "fa-heart" },
  { id: "WATCHLIST", label: "Watchlist", dot: "bg-blue-500", icon: "fa-eye" },
  { id: "MISSING", label: "Missing", dot: "bg-gray-300", icon: "fa-circle" },
];

const STATUS_META = {
  OWNED: { label: "Owned", dot: "bg-green-500" },
  WANTED: { label: "Wanted", dot: "bg-yellow-400" },
  WATCHLIST: { label: "Watchlist", dot: "bg-blue-500" },
  MISSING: { label: "Missing", dot: "bg-gray-300" },
};

export default function ElementStatusOverlay({
  element,
  currentState = "MISSING",
  sampleCount = 0,
  busy = false,
  onSetState,
  onEditNotes,
  onClose,
}) {
  if (!element) return null;

  const meta = STATUS_META[currentState] || STATUS_META.MISSING;
  const hasNotes = sampleCount > 0;

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 flex items-start justify-center pt-24"
      style={{ zIndex: 1000 }}
      onClick={onClose}
    >
      <div
        className="w-[420px] max-w-[94vw] bg-white rounded-lg border border-gray-300 shadow-xl"
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
            <p className="text-xs text-gray-500 leading-tight flex items-center gap-1.5">
              Status:
              <span className="inline-flex items-center gap-1 font-medium text-gray-600">
                <span className={`w-2 h-2 rounded-sm inline-block ${meta.dot}`}></span> {meta.label}
              </span>
              {sampleCount > 0 && (
                <span className="text-gray-400">&middot; {sampleCount} sample{sampleCount === 1 ? "" : "s"}</span>
              )}
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

        {/* Status options */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-gray-500 mb-2">Set status</p>
          <div className="space-y-1.5">
            {STATUS.map((s) => {
              const active = s.id === currentState;
              return (
                <button
                  key={s.id}
                  type="button"
                  disabled={busy}
                  onClick={() => onSetState?.(s.id)}
                  className={
                    "w-full flex items-center gap-3 px-3 py-2 rounded text-sm text-left border " +
                    (active
                      ? "border-gray-500 bg-gray-100 text-gray-800 font-medium"
                      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50")
                  }
                  style={{ cursor: busy ? "default" : "pointer" }}
                >
                  <span className={`w-2.5 h-2.5 rounded-sm inline-block ${s.dot}`}></span>
                  <span className="flex-1">{s.label}</span>
                  {active && <i className="fa-solid fa-check text-gray-500 text-xs"></i>}
                </button>
              );
            })}
          </div>
        </div>

        {/* Actions */}
        <footer className="px-5 py-4 border-t border-gray-200 bg-gray-50 rounded-b-lg flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={onEditNotes}
            disabled={busy}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-100"
            style={{ cursor: "pointer" }}
          >
            <i className={`fa-solid ${hasNotes ? "fa-pen-to-square" : "fa-plus"} mr-1.5`}></i>
            {hasNotes ? "Edit Notes" : "Add Note"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 text-sm font-medium text-white bg-luc-blue rounded hover:opacity-90"
            style={{ cursor: "pointer", border: "none", backgroundColor: "#4f7cff" }}
          >
            <i className="fa-solid fa-check mr-1.5"></i>
            Confirm
          </button>
        </footer>
      </div>
    </div>
  );
}
