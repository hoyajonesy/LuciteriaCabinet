/**
 * AddToWishlistModal — matches wireframe: add-to-wishlist.html
 * Compact periodic table (full table incl. lanthanides & actinides) on the
 * left, form-factor / variant / priority chooser on the right.
 */
import { useEffect, useState } from "react";
import { useFetcher } from "@remix-run/react";

const PRIORITIES = [
  { label: "High", value: 3 },
  { label: "Medium", value: 2 },
  { label: "Low", value: 1 },
];

const LUCITE_VARIANTS = ["Color — Clear", "Color — Smoke", "Color — Blue Tint", "Color — Amber"];

export default function AddToWishlistModal({
  elements = [],
  formats = [],
  defaultFormat = "",
  ownedSymbols = [],
  wantedSymbols = [],
  watchlistSymbols = [],
  onClose,
}) {
  const fetcher = useFetcher();
  const COMPACT = elements;
  const [selectedSym, setSelectedSym] = useState("Au");
  const initialFormat =
    defaultFormat && formats.some((f) => f.id === defaultFormat)
      ? defaultFormat
      : (formats[0] && formats[0].id) || "other";
  const [formFactor, setFormFactor] = useState(initialFormat);
  const [variant, setVariant] = useState(LUCITE_VARIANTS[0]);
  const [priority, setPriority] = useState(3);

  const selected = COMPACT.find((e) => e.sym === selectedSym) || COMPACT.find((e) => e.sym === "Au") || { name: "Gold", sym: "Au" };
  const submitting = fetcher.state !== "idle";

  let availableSizes = [];
  if (selected && selected.size) {
    try {
      availableSizes = JSON.parse(selected.size);
    } catch (e) {
      availableSizes = [];
    }
  }

  // A format is selectable if it is a "personal" format (no shopifyKey / not
  // purchasable) OR the element is actually sold in that Shopify size.
  const isFormatAvailable = (f) => {
    if (!f) return false;
    if (!f.purchasable || !f.shopifyKey) return true;
    return availableSizes.includes(f.shopifyKey);
  };
  const formatById = (id) => formats.find((f) => f.id === id);

  // Keep the current form factor valid when the selected element changes.
  // Preserve the user's (defaulted) choice when possible; only switch away if
  // it isn't available for this element.
  useEffect(() => {
    const cur = formatById(formFactor);
    if (!isFormatAvailable(cur)) {
      const firstAvail = formats.find((f) => isFormatAvailable(f));
      setFormFactor(firstAvail ? firstAvail.id : "other");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSym]);

  const canSubmit = isFormatAvailable(formatById(formFactor)) && !submitting;

  // Close after a successful add
  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data && fetcher.data.ok) {
      onClose();
    }
  }, [fetcher.state, fetcher.data]);

  const addToWishlist = () => {
    fetcher.submit(
      {
        intent: "add-to-wishlist",
        symbol: selectedSym,
        priority: String(priority),
        format: formFactor,
      },
      { method: "post", action: "/app/cabinet/wishlist" }
    );
  };

  return (
    <div
      className="fixed inset-0 bg-gray-900/40 flex items-start justify-center pt-16 px-4 z-50 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-gray-100 w-full max-w-[1200px] rounded-lg shadow-xl my-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start px-8 pt-7 pb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Add to Wishlist</h1>
            <p className="text-sm text-gray-500 mt-1">
              Pick an element and tell us how you'd like to collect it.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-3 px-8 pb-5">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-700 text-white text-xs flex items-center justify-center">1</span>
            <span className="text-sm text-gray-700 font-medium">Select element</span>
          </div>
          <span className="flex-1 max-w-[80px] h-px bg-gray-300" />
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-gray-300 text-gray-600 text-xs flex items-center justify-center">2</span>
            <span className="text-sm text-gray-500">Choose preference</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-6 px-8 pb-8">
          {/* LEFT — element grid */}
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">Step 1 · Select an element</h2>
            <p className="text-xs text-gray-500 mb-4">
              {selected.name} ({selected.sym}) is selected.
            </p>
            <div className="grid gap-1" style={{ gridTemplateColumns: "repeat(18,1fr)" }}>
              {COMPACT.map((el) => {
                const isSel = el.sym === selectedSym;
                return (
                  <div
                    key={el.sym}
                    className={`el${isSel ? " sel" : ""}`}
                    style={{ gridColumn: el.col, gridRow: el.row }}
                    onClick={() => setSelectedSym(el.sym)}
                    title={el.name}
                  >
                    <span className="num">{el.z}</span>
                    <span className="sym">{el.sym}</span>
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-3">
              The full periodic table is shown — lanthanides and actinides appear as the two rows below the main table.
            </p>
          </section>

          {/* RIGHT — preferences */}
          <section className="bg-white border border-gray-200 rounded-lg p-5">
            <h2 className="text-sm font-semibold text-gray-800 mb-1">
              Step 2 · Choose your preference for {selected.name}
            </h2>
            <p className="text-xs text-gray-500 mb-5">Select the form factor and any variant you'd like.</p>

            {/* Form Factor */}
            <fieldset className="mb-5">
              <legend className="text-xs uppercase tracking-wide text-gray-400 mb-2">Form Factor</legend>
              <div className="space-y-2">
                {formats.map((f) => {
                  const active = formFactor === f.id;
                  const isAvailable = isFormatAvailable(f);

                  // Get price & stock info only for purchasable (Shopify-mapped) formats
                  const formatVariant =
                    f.purchasable && f.shopifyKey ? selected.productsByFormat?.[f.shopifyKey] : null;
                  const price = formatVariant?.price;
                  const available = formatVariant?.availableForSale;
                  const qty = formatVariant?.inventoryQty;
                  
                  const stockStatus = !formatVariant ? "Out of Stock" : !available ? "Out of Stock" : (qty > 0 && qty <= 5) ? "Low Stock" : "In Stock";
                  
                  let labelClass = "";
                  if (!isAvailable) {
                    labelClass = "border-gray-200 bg-gray-50 text-gray-400 opacity-40 cursor-not-allowed";
                  } else if (active) {
                    labelClass = "border-blue-500 bg-blue-50/50 text-blue-900 ring-2 ring-blue-100/50 font-medium";
                  } else {
                    labelClass = "border-gray-300 bg-white text-gray-700 hover:bg-gray-50/80 hover:border-gray-400";
                  }

                  return (
                    <label
                      key={f.id}
                      className={`flex items-center justify-between border rounded-lg px-4 py-3 text-sm transition-all select-none ${labelClass}`}
                      onClick={(e) => {
                        if (!isAvailable) {
                          e.preventDefault();
                          return;
                        }
                        setFormFactor(f.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="ff"
                          className="accent-blue-500"
                          checked={active}
                          disabled={!isAvailable}
                          onChange={() => {}} // Handled by label click
                        />
                        <span>{f.name}</span>
                      </div>
                      
                      {isAvailable && formatVariant ? (
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-gray-800">{price != null ? `$${price.toFixed(2)}` : "—"}</span>
                          {stockStatus === "In Stock" && (
                            <span className="text-[10px] font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded border border-green-200">In Stock</span>
                          )}
                          {stockStatus === "Low Stock" && (
                            <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">Low Stock</span>
                          )}
                          {stockStatus === "Out of Stock" && (
                            <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded border border-red-100">Out of Stock</span>
                          )}
                        </div>
                      ) : isAvailable ? (
                        <span className="text-xs text-gray-400">{f.purchasable ? "Standard Price" : "Personal"}</span>
                      ) : (
                        <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded border border-gray-200">Unavailable</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {/* Conditional variant (lucite only) */}
            {formatById(formFactor)?.shopifyKey === "lucite_cube" && (
              <div className="mb-5 border-t border-dashed border-gray-300 pt-4">
                <label className="text-xs uppercase tracking-wide text-gray-400 mb-2 block">
                  Variant <span className="text-gray-400 normal-case">(if applicable)</span>
                </label>
                <p className="text-[11px] text-gray-400 mb-2">Lucite cubes are available in multiple finishes.</p>
                <div className="relative">
                  <select
                    value={variant}
                    onChange={(e) => setVariant(e.target.value)}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm text-gray-700 bg-white appearance-none"
                  >
                    {LUCITE_VARIANTS.map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                  <i className="fa-solid fa-chevron-down absolute right-3 top-3 text-xs text-gray-400 pointer-events-none" />
                </div>
              </div>
            )}

            {/* Priority */}
            <div className="mb-6">
              <label className="text-xs uppercase tracking-wide text-gray-400 mb-2 block">Priority</label>
              <div className="flex gap-2">
                {PRIORITIES.map((p) => {
                  const active = priority === p.value;
                  return (
                    <button
                      key={p.value}
                      type="button"
                      onClick={() => setPriority(p.value)}
                      className={`flex-1 text-center border rounded px-2 py-1.5 text-sm ${active
                        ? "border-gray-600 bg-gray-100 text-gray-800"
                        : "border-gray-300 bg-gray-50 text-gray-600"
                        }`}
                    >
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <button
              type="button"
              onClick={addToWishlist}
              disabled={!canSubmit}
              className="w-full bg-gray-700 text-white rounded px-4 py-2.5 text-sm font-medium hover:bg-gray-800 disabled:opacity-60"
            >
              <i className="fa-solid fa-heart mr-1" /> {submitting ? "Adding…" : "Add to Wishlist"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
