/**
 * ElementPickerModal — shared search / filter / multi-select element picker.
 *
 * Extracted from the Collection Passport "Choose Featured Elements" modal so the
 * same search + filter + multi-select foundation can be reused by the
 * subscription owned-items onboarding UI (FR-11), adapted from a "mark as
 * featured" purpose to a "mark as owned" purpose.
 *
 * Two exports:
 *  - `ElementPickerGrid`  — the search box + selectable card grid (no chrome).
 *                           Use it inline (e.g. the full-page onboarding picker)
 *                           or inside a modal.
 *  - `ElementPickerModal` — default export: a modal shell (header / scroll body /
 *                           footer) that renders an `ElementPickerGrid` inside.
 *
 * Differences from Passport's original picker, per FR-11:
 *  - `maxSelectable` is OPTIONAL. Pass `null`/`undefined` for NO cap (onboarding
 *    must not inherit Passport's five-item cap).
 *  - `isSuggested` lets a caller flag system-suggested items so pre-checked
 *    (order-history) items are visually distinct from subscriber-added ones
 *    (FR-12).
 *
 * Item shape (all optional except a stable key): {
 *   uid, symbol, name, formatName, imageUrl, isWishlisted
 * }
 * A stable React key is taken from `item.uid ?? item.symbol`.
 */

/**
 * Search box + selectable card grid. Filters `items` internally by name/symbol
 * against `search`.
 *
 * @param {Object} props
 * @param {Array<Object>} props.items - Full candidate list (unfiltered).
 * @param {(item:Object)=>boolean} props.isSelected - Whether an item is selected.
 * @param {(item:Object)=>void} props.onToggle - Toggle handler.
 * @param {string} props.search - Current search text (controlled).
 * @param {(value:string)=>void} props.onSearchChange - Search input handler.
 * @param {number|null} [props.maxSelectable] - Optional selection cap; null = unlimited.
 * @param {number} [props.selectedCount] - Current selected count (for cap enforcement).
 * @param {(item:Object)=>boolean} [props.isSuggested] - Flag system-suggested items (FR-12).
 * @param {string} [props.emptyText] - Shown when `items` is empty.
 * @param {string} [props.noMatchText] - Shown when search matches nothing.
 * @param {string} [props.searchPlaceholder]
 */
export function ElementPickerGrid({
  items,
  isSelected,
  onToggle,
  search,
  onSearchChange,
  maxSelectable = null,
  selectedCount = 0,
  isSuggested = null,
  emptyText = "No elements available.",
  noMatchText = "No elements match your search.",
  searchPlaceholder = "Search elements…",
}) {
  const q = (search || "").trim().toLowerCase();
  const filtered = !q
    ? items
    : items.filter(
        (o) =>
          (o.name || "").toLowerCase().includes(q) ||
          (o.symbol || "").toLowerCase().includes(q)
      );

  const capReached = maxSelectable != null && selectedCount >= maxSelectable;

  return (
    <div>
      <div className="pb-3 mb-1 sticky top-0 bg-white z-10">
        <input
          type="text"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          className="w-full text-sm border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-luc-blue"
        />
      </div>

      <div>
        {items.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">{emptyText}</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-10">{noMatchText}</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {filtered.map((el) => {
              const sel = isSelected(el);
              const disabled = !sel && capReached;
              const suggested = typeof isSuggested === "function" ? isSuggested(el) : false;
              return (
                <button
                  key={el.uid ?? el.symbol}
                  type="button"
                  onClick={() => onToggle(el)}
                  disabled={disabled}
                  aria-pressed={sel}
                  className={`flex items-center gap-3 border rounded-lg p-2.5 text-left transition-colors ${
                    sel
                      ? "border-luc-blue bg-blue-50"
                      : disabled
                      ? "border-gray-100 opacity-50 cursor-not-allowed"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-11 h-11 rounded-md bg-gray-100 border border-gray-200 overflow-hidden flex items-center justify-center flex-shrink-0">
                    {el.imageUrl ? (
                      <img src={el.imageUrl} alt={el.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-sm font-semibold luc-heading">{el.symbol}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800 truncate">{el.name}</p>
                    <p className="text-xs text-gray-400 truncate">
                      {el.symbol}
                      {el.formatName ? ` · ${el.formatName}` : ""}
                    </p>
                  </div>
                  {suggested && (
                    <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <i className="fa-solid fa-wand-magic-sparkles mr-1" />Suggested
                    </span>
                  )}
                  {el.isWishlisted && (
                    <span className="text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-full flex-shrink-0">
                      <i className="fa-solid fa-heart mr-1" />Wishlist
                    </span>
                  )}
                  {sel && <i className="fa-solid fa-circle-check text-luc-blue flex-shrink-0" />}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Modal shell around an `ElementPickerGrid`.
 *
 * @param {Object} props
 * @param {boolean} props.open
 * @param {()=>void} props.onClose
 * @param {React.ReactNode} props.title
 * @param {React.ReactNode} [props.headerRight] - e.g. a "3/5 selected" counter.
 * @param {React.ReactNode} [props.footer] - footer actions (Cancel / Save …).
 * @param {Object} props.gridProps - props forwarded to `ElementPickerGrid`.
 */
export default function ElementPickerModal({ open, onClose, title, headerRight, footer, gridProps }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="luc-heading text-base font-medium flex items-center">
            {title}
            {headerRight != null && (
              <span className="text-sm text-gray-400 font-normal ml-2">{headerRight}</span>
            )}
          </h3>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <i className="fa-solid fa-xmark text-lg" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 min-h-0">
          <ElementPickerGrid {...gridProps} />
        </div>

        {footer != null && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
