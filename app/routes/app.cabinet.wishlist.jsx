/**
 * Wishlist Page — matches wireframe: wishlist-private.html
 * Wired to real WANTED collection items (priority + format are real, editable).
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useFetcher, Link } from "@remix-run/react";
import { useState, useEffect } from "react";
import AppNav from "../components/AppNav";
import AddToWishlistModal from "../components/AddToWishlistModal";
import Toast from "../components/Toast";
import { productUrlForShopProduct } from "../lib/format-display";
import { getUserId } from "../lib/session.server";
import { requireNotFrozen } from "../lib/frozen-guard.server";
import { getUserById } from "../lib/auth.server";
import {
  getUserCollectionByState,
  updateCollectionState,
  getCollectionStats,
} from "../lib/collection.server";
import { getUnreadCount } from "../lib/notifications-db.server";
import { ELEMENTS_118 } from "../data/elements.server";
import { FORMATS, FORMAT_LIST, parseSizes } from "../lib/formats";
import { prisma } from "../lib/db.server";


const PRIORITY_LABEL = { 3: "High", 2: "Medium", 1: "Low", 0: "Low" };

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");
  if (!authUser.onboardingCompleted) return redirect("/onboarding/welcome");

  const wantedItems = await getUserCollectionByState(userId, "WANTED");
  const stats = await getCollectionStats(userId);
  const unreadCount = await getUnreadCount(userId);

  const preferredFormat = authUser.subscriptionFormat || "lucite_cube";

  // Fetch all products from Prisma database to get fresh stock and prices
  const allProducts = await prisma.product.findMany();
  const productMap = new Map(allProducts.map(p => [p.sku, p]));

  const wishlist = wantedItems.map((it) => {
    const el = ELEMENTS_118.find((e) => e.sym === it.elementSymbol);
    let variant = null;

    if (it.format && el?.productsByFormat?.[it.format]) {
      variant = el.productsByFormat[it.format];
    } else if (preferredFormat && el?.productsByFormat?.[preferredFormat]) {
      variant = el.productsByFormat[preferredFormat];
    } else if (el?.products && el.products.length > 0) {
      variant = el.products[0];
    }

    const dbProduct = variant?.sku ? productMap.get(variant.sku) : null;

    const price = dbProduct ? dbProduct.priceUsd : (variant?.price ?? 0);
    const qty = dbProduct ? dbProduct.inventoryQty : (variant?.inventoryQty ?? 0);
    const status = dbProduct ? dbProduct.status : (variant?.availableForSale ? "Active" : "Archived");

    const isAvailable = dbProduct ? (status === "Active" && qty > 0) : (variant?.availableForSale ?? false);
    const stock = !variant ? "Out of Stock" : !isAvailable ? "Out of Stock" : (qty > 0 && qty <= 5) ? "Low Stock" : "In Stock";

    const displayName = variant?.title || it.elementName;

    let fmt = "No format chosen";
    if (it.format && FORMATS[it.format]) {
      fmt = FORMATS[it.format].name;
    } else if (variant?.variantTitle && variant.variantTitle !== "Default Title") {
      fmt = variant.variantTitle;
    } else if (variant?.size) {
      const sizes = parseSizes(variant.size);
      const sizeId = sizes.length > 0 ? sizes[0] : variant.size;
      if (FORMATS[sizeId]) {
        fmt = FORMATS[sizeId].name;
      } else {
        fmt = variant.size;
      }
    }
    const productHandle = dbProduct?.handle || variant?.handle || null;
    const variantId = dbProduct?.shopifyVariantId || variant?.variantId || null;

    return {
      symbol: it.elementSymbol,
      name: displayName,
      atomicNumber: it.atomicNumber,
      format: fmt,
      priority: it.priority || 1,
      price,
      stock,
      productHandle,
      variantId,
    };
  });

  // sort by priority desc, then atomic number
  wishlist.sort((a, b) => b.priority - a.priority || a.atomicNumber - b.atomicNumber);

  // Pass every element with its canonical position. Main table (rows 1-7)
  // plus lanthanides (row 9) and actinides (row 10) so they are selectable
  // in the wishlist picker.
  const compactElements = ELEMENTS_118.map((el) => ({
    z: el.z,
    sym: el.sym,
    name: el.name,
    row: el.row,
    col: el.col,
    size: el.size,
    productsByFormat: el.productsByFormat,
    products: el.products,
  }));

  return json({
    wishlist,
    ownedSymbols: stats.ownedSymbols,
    wantedSymbols: stats.wantedSymbols,
    watchlistSymbols: stats.watchlistSymbols,
    unreadCount,
    firstName: authUser.firstName || "Collector",
    shareSlug: (authUser.firstName || "collector").toLowerCase().replace(/[^a-z0-9]/g, "") + "-" + userId.slice(0, 4),
    compactElements,
    modalFormats: FORMAT_LIST.map((f) => ({ id: f.id, name: f.name })),
  });
};

export const action = async ({ request }) => {
  const userId = await getUserId(request);
  await requireNotFrozen(userId);
  if (!userId) return json({ error: "Not authenticated" }, { status: 401 });
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "set-priority") {
    const symbol = form.get("symbol");
    const priority = parseInt(form.get("priority"), 10) || 1;
    await updateCollectionState(userId, symbol, "WANTED", { priority });
  } else if (intent === "remove") {
    const symbol = form.get("symbol");
    await updateCollectionState(userId, symbol, "MISSING");
  } else if (intent === "add-to-wishlist") {
    const symbol = form.get("symbol");
    const priority = parseInt(form.get("priority"), 10) || 1;
    const format = form.get("format") || null;
    await updateCollectionState(userId, symbol, "WANTED", { priority, format });
  }

  return json({ ok: true });
};

function StockPill({ stock }) {
  const cls =
    stock === "In Stock"
      ? "bg-gray-100 border-gray-300 text-gray-700"
      : stock === "Low Stock"
        ? "bg-gray-100 border-gray-300 text-gray-600"
        : "bg-gray-50 border-gray-200 text-gray-400";
  return (
    <span className={`inline-block text-xs px-2.5 py-1 rounded-full border ${cls} whitespace-nowrap`}>
      {stock}
    </span>
  );
}

export default function WishlistPage() {
  const { wishlist, unreadCount, firstName, shareSlug, ownedSymbols, wantedSymbols, watchlistSymbols, compactElements, modalFormats } =
    useLoaderData();
  const fetcher = useFetcher();
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [sort, setSort] = useState("priority");
  const [copied, setCopied] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [toastMessage, setToastMessage] = useState(null);

  const [shareUrl, setShareUrl] = useState(`https://luciteria.vercel.app/w/${shareSlug}`);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setShareUrl(window.location.origin + "/w/" + shareSlug);
    }
  }, [shareSlug]);

  let rows = wishlist.filter((w) => {
    if (priorityFilter === "all") return true;
    return PRIORITY_LABEL[w.priority].toLowerCase() === priorityFilter;
  });
  rows = [...rows].sort((a, b) => {
    if (sort === "priority") return b.priority - a.priority || a.atomicNumber - b.atomicNumber;
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "price-high") return b.price - a.price;
    if (sort === "price-low") return a.price - b.price;
    return 0;
  });

  const getShareMessage = () => {
    if (wishlist && wishlist.length > 0) {
      const elementsText = wishlist
        .slice(0, 5)
        .map((item) => item.symbol)
        .join(", ");
      const count = wishlist.length;
      const suffix = count > 5 ? " and more" : "";
      return `Check out my element wishlist! I'm collecting: ${elementsText}${suffix}.`;
    }
    return "Check out my element wishlist!";
  };

  const handleCopyLink = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setCopied(true);
          setToastMessage("Link copied!");
          setTimeout(() => setCopied(false), 1800);
        })
        .catch(() => {
          fallbackCopyText(shareUrl);
        });
    } else {
      fallbackCopyText(shareUrl);
    }
  };

  const shareFacebook = () => {
    const url = encodeURIComponent(shareUrl);
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
    window.open(fbUrl, "_blank", "noopener,noreferrer");
  };

  const shareTwitter = () => {
    const url = encodeURIComponent(shareUrl);
    const text = encodeURIComponent(getShareMessage());
    const twitterUrl = `https://twitter.com/intent/tweet?url=${url}&text=${text}`;
    window.open(twitterUrl, "_blank", "noopener,noreferrer");
  };

  const handleEmailClick = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          setToastMessage("Wishlist link copied to clipboard! Opening mail client...");
        })
        .catch(() => {
          fallbackCopyText(shareUrl);
        });
    } else {
      fallbackCopyText(shareUrl);
    }
  };

  const fallbackCopyText = (text) => {
    try {
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.top = "0";
      textArea.style.left = "0";
      textArea.style.width = "2em";
      textArea.style.height = "2em";
      textArea.style.padding = "0";
      textArea.style.border = "none";
      textArea.style.outline = "none";
      textArea.style.boxShadow = "none";
      textArea.style.background = "transparent";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand("copy");
      document.body.removeChild(textArea);
      if (successful) {
        setCopied(true);
        setToastMessage("Link copied!");
        setTimeout(() => setCopied(false), 1800);
      }
    } catch (err) {
      console.error("Unable to copy", err);
    }
  };

  const copyProductLink = (w) => {
    const url = productUrlForShopProduct({ handle: w.productHandle, variantId: w.variantId }, w.name);
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url)
        .then(() => {
          setToastMessage("Link copied!");
        })
        .catch(() => {
          fallbackCopyText(url);
        });
    } else {
      fallbackCopyText(url);
    }
  };

  const setPriority = (symbol, priority) =>
    fetcher.submit({ intent: "set-priority", symbol, priority: String(priority) }, { method: "post" });
  const removeItem = (symbol) =>
    fetcher.submit({ intent: "remove", symbol }, { method: "post" });

  return (
    <div className="flex min-h-screen bg-gray-100">
      <AppNav mode="customer" customerName={firstName} currentPath="/app/cabinet/wishlist" unreadCount={unreadCount} />
      <main className="luc-main flex-1">
        <div className="min-h-[900px] max-w-[1160px] mx-auto px-8 py-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="luc-heading text-2xl font-medium">My Wishlist</h1>
              <p className="text-sm text-gray-500 mt-1">
                {wishlist.length} element{wishlist.length !== 1 ? "s" : ""} you're hoping to collect. Share the whole list, or just one item.
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
              >
                <i className="fa-solid fa-plus mr-2" />Add Element
              </button>
              <button
                onClick={handleCopyLink}
                className="text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white px-4 py-2 rounded-btn"
              >
                <i className="fa-solid fa-share-nodes mr-2" />Share Wishlist
              </button>
            </div>
          </div>

          {/* Share card */}
          <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6">
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-3">
              Share entire wishlist via
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                <span className="px-3 py-2 text-sm text-gray-600 bg-white">{shareUrl}</span>
                <button onClick={handleCopyLink} className="px-3 py-2 text-sm bg-gray-100 text-gray-700 border-l border-gray-300 hover:bg-gray-200">
                  {copied ? "Copied!" : "Copy Link"}
                </button>
              </div>
              <a
                href={`mailto:?subject=${encodeURIComponent("My Wishlist")}&body=${encodeURIComponent(`${getShareMessage()}\n\n${shareUrl}`)}`}
                onClick={handleEmailClick}
                className="text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50 inline-flex items-center"
              >
                <i className="fa-solid fa-envelope mr-2" />Email
              </a>
              <button onClick={shareFacebook} className="text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50">
                <i className="fa-brands fa-facebook mr-2" />Facebook
              </button>
              <button onClick={shareTwitter} className="text-sm border border-gray-300 bg-white text-gray-700 px-3 py-2 rounded-md hover:bg-gray-50">
                <i className="fa-brands fa-x-twitter mr-2" />Twitter
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Tip: anyone with the link can view your wishlist, but only you can edit it.
            </p>
          </div>

          {/* Filter bar */}
          <div className="flex flex-wrap justify-between items-center gap-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Filter by priority:</span>
              {["all", "high", "medium", "low"].map((p) => (
                <button
                  key={p}
                  onClick={() => setPriorityFilter(p)}
                  className={`text-sm px-3 py-1.5 rounded-md border ${priorityFilter === p
                    ? "border-gray-600 bg-gray-100 text-gray-800 font-medium"
                    : "border-gray-300 bg-white text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {p === "all" ? "All" : p.charAt(0).toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Sort:</span>
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="text-sm border border-gray-300 rounded-md px-3 py-1.5 bg-white text-gray-700"
              >
                <option value="priority">Priority</option>
                <option value="name">Name</option>
                <option value="price-high">Price: High to Low</option>
                <option value="price-low">Price: Low to High</option>
              </select>
            </div>
          </div>

          {/* Table */}
          {rows.length > 0 ? (
            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              <div className="grid grid-cols-[60px_1fr_110px_130px_140px_120px] bg-gray-100 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <div></div>
                <div>Element</div>
                <div>Price</div>
                <div>Stock</div>
                <div>Priority</div>
                <div className="text-center">Actions</div>
              </div>
              {rows.map((w) => (
                <div
                  key={w.symbol}
                  className="grid grid-cols-[60px_1fr_110px_130px_140px_120px] items-center px-4 py-3 border-t border-gray-100"
                >
                  <div className="w-10 h-10 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-xs text-gray-400">
                    {w.symbol}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{w.name}</div>
                    <div className="text-xs text-gray-400">{w.format}</div>
                  </div>
                  <div className="text-sm text-gray-700">${w.price.toFixed(2)}</div>
                  <div>
                    <StockPill stock={w.stock} />
                  </div>
                  <div>
                    <select
                      value={w.priority}
                      onChange={(e) => setPriority(w.symbol, parseInt(e.target.value, 10))}
                      className="text-sm border border-gray-300 rounded-md px-2 py-1.5 bg-white text-gray-700 w-[110px]"
                    >
                      <option value={3}>High</option>
                      <option value={2}>Medium</option>
                      <option value={1}>Low</option>
                    </select>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    {ownedSymbols?.includes(w.symbol) && (
                      <Link
                        to={`/app/cabinet/passport?feature=${w.symbol}`}
                        className="w-8 h-8 rounded-md border border-gray-300 bg-white text-luc-blue hover:bg-gray-50 flex items-center justify-center"
                        title="Feature on Passport"
                        style={{ textDecoration: "none" }}
                      >
                        <i className="fa-solid fa-id-card" />
                      </Link>
                    )}
                    <button
                      onClick={() => copyProductLink(w)}
                      className="w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-500 hover:bg-gray-50"
                      title="Share this item"
                    >
                      <i className="fa-solid fa-share-nodes" />
                    </button>
                    <button
                      onClick={() => removeItem(w.symbol)}
                      className="w-8 h-8 rounded-md border border-gray-300 bg-white text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                      title="Remove"
                    >
                      <i className="fa-solid fa-trash" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white border border-gray-200 rounded-lg p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-heart text-gray-400 text-xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">
                {wishlist.length === 0 ? "Your wishlist is empty" : "No items match this filter"}
              </h3>
              <p className="text-sm text-gray-500 mb-4">
                Add elements you're hoping to collect and keep track of them here.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm bg-luc-blue hover:bg-luc-blue-hover transition-colors text-white px-4 py-2 rounded-btn"
              >
                <i className="fa-solid fa-plus mr-2" />Add Element
              </button>
            </div>
          )}

          {/* Empty-state encourage card (shown when there are items) */}
          {rows.length > 0 && (
            <div className="mt-6 border-2 border-dashed border-gray-300 rounded-lg p-10 text-center">
              <div className="w-14 h-14 rounded-full bg-gray-100 border border-gray-300 flex items-center justify-center mx-auto mb-4">
                <i className="fa-solid fa-heart text-gray-400 text-xl" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800 mb-1">Want to add more?</h3>
              <p className="text-sm text-gray-500 mb-4">
                Browse the periodic table and add any element you're hoping to collect.
              </p>
              <button
                onClick={() => setShowAdd(true)}
                className="text-sm border border-gray-300 bg-white text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50"
              >
                <i className="fa-solid fa-plus mr-2" />Add Element
              </button>
            </div>
          )}
        </div>
      </main>

      {showAdd && (
        <AddToWishlistModal
          elements={compactElements}
          formats={modalFormats}
          ownedSymbols={ownedSymbols}
          wantedSymbols={wantedSymbols}
          watchlistSymbols={watchlistSymbols}
          onClose={() => setShowAdd(false)}
        />
      )}
      {toastMessage && (
        <Toast message={toastMessage} type="success" onDismiss={() => setToastMessage(null)} />
      )}
    </div>
  );
}
