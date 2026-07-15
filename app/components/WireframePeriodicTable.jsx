/**
 * WireframePeriodicTable — pixel-faithful port of the collection.html /
 * onboarding-log-owned.html / collection-notes-overlay.html periodic tables.
 *
 * Uses the global .ptable/.frow/.cell/.owned/.wanted/.watch/.selected classes
 * with responsive font sizes defined in tailwind.css. Renders all 118 elements 
 * positioned by their row/col.
 *
 * Props:
 *   elements    — array of { z, sym, name, row, col }
 *   states      — { [sym]: "OWNED" | "WANTED" | "WATCHLIST" }
 *   selectedSym — symbol to highlight with the gray "selected" ring
 *   showChecks  — if true, owned cells show a green check (log-owned mode)
 *   counts      — { [sym]: number } sample counts; a badge shows when > 1
 *   onCellClick — (element) => void
 *   className   — optional CSS class to apply to the container
 */

const STATE_CLASS = {
  OWNED: "owned",
  WANTED: "wanted",
  WATCHLIST: "watch",
  UNAVAILABLE: "unavailable",
};

export default function WireframePeriodicTable({
  elements = [],
  states = {},
  selectedSym = null,
  showChecks = false,
  counts = {},
  onCellClick,
  className = "",
}) {
  const renderCell = (el) => {
    const row = Number(el.row);
    const col = Number(el.col);

    // Validate coordinates (1-based grid indexing)
    if (!row || !col || row < 1 || row > 10 || col < 1 || col > 18) {
      return null;
    }

    const state = states[el.sym];
    const stateClass = STATE_CLASS[state] || "";
    const isSelected = selectedSym && el.sym === selectedSym;
    const isUnavailable = state === "UNAVAILABLE" || el.available === false;
    const cls = `cell ${stateClass}${isSelected ? " selected" : ""}`.trim();

    return (
      <div
        key={el.sym}
        className={cls}
        style={{
          gridColumn: col,
          gridRow: row,
          ...(isUnavailable ? { opacity: 0.35, cursor: "not-allowed" } : {}),
          transition: "transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s",
        }}
        onClick={onCellClick ? () => onCellClick(el) : undefined}
        title={isUnavailable
          ? `${el.z}. ${el.name} (${el.sym}) — not available in this format`
          : `${el.z}. ${el.name} (${el.sym})`
        }
      >
        <span className="num">{el.z}</span>
        {showChecks && state === "OWNED" && (
          <span className="chk">
            <i className="fa-solid fa-check"></i>
          </span>
        )}
        {!showChecks && counts[el.sym] > 1 && (
          <span className="cnt">{counts[el.sym]}</span>
        )}
        <span className="sym">{el.sym}</span>
        <span className="nm">{el.name}</span>
      </div>
    );
  };

  return (
    <div className={className}>
      <div
        className="ptable mb-2"
        style={{
          gridTemplateRows: "repeat(10, minmax(0, 1fr))",
          gridTemplateColumns: "repeat(18, minmax(0, 1fr))",
          display: "grid",
        }}
      >
        {elements.map(renderCell)}
      </div>
    </div>
  );
}
