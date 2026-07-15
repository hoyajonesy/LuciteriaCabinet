import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useState, useCallback, useMemo } from "react";
import AppNav from "../components/AppNav";
import WireframePeriodicTable from "../components/WireframePeriodicTable";

import { ELEMENTS_118 } from "../data/elements.server";
import { FORMAT_LIST } from "../lib/formats";
import { elementsForDisplayFormat, productUrlForShopProduct } from "../lib/format-display";
import { getUserId } from "../lib/session.server";
import { getUserById } from "../lib/auth.server";
import { getCollectionStats } from "../lib/collection.server";
import { getUnreadCount } from "../lib/notifications-db.server";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");
  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");
  if (!authUser.onboardingCompleted) return redirect("/onboarding/welcome");

  const preferredFormat = authUser.subscriptionFormat || "lucite_cube";
  const unreadCount = await getUnreadCount(userId);
  const stats = await getCollectionStats(userId, preferredFormat);

  // Owned-state map so the shop can dim/mark elements you already own.
  const collectionStates = {};
  for (const sym of stats.ownedSymbols) collectionStates[sym] = "OWNED";

  const elementsByFormat = {};
  const linksByFormat = {};
  for (const f of FORMAT_LIST) {
    const formattedElements = elementsForDisplayFormat(ELEMENTS_118, f.id).map((e) => ({
      z: e.z,
      sym: e.sym,
      name: e.name,
      elementName: e.elementName,
      row: e.row,
      col: e.col,
      group: e.group,
      product: e.product,
      available: e.available,
    }));

    elementsByFormat[f.id] = formattedElements;
    linksByFormat[f.id] = {};
    for (const el of formattedElements) {
      linksByFormat[f.id][el.sym] = {
        url: productUrlForShopProduct(el.product, el.elementName),
        title: el.product?.title || el.elementName,
        variantTitle: el.product?.variantTitle || null,
        sku: el.product?.sku || null,
      };
    }
  }

  const formats = FORMAT_LIST.map((f) => ({ id: f.id, name: f.name }));

  return json({
    elementsByFormat,
    linksByFormat,
    collectionStates,
    formats,
    preferredFormat,
    unreadCount,
    authUser: { firstName: authUser.firstName },
  });
};

export default function ShopPage() {
  const {
    elementsByFormat, linksByFormat, collectionStates,
    formats, preferredFormat, unreadCount, authUser,
  } = useLoaderData();

  const [format, setFormat] = useState(preferredFormat);

  const selectedFormat = format && format !== "" ? format : "other";
  const elements = elementsByFormat[selectedFormat] || elementsByFormat.other || [];
  const links = linksByFormat[selectedFormat] || linksByFormat.other || {};

  const tableStates = useMemo(() => {
    return { ...collectionStates };
  }, [collectionStates]);

  const handleCellClick = useCallback(
    (el) => {
      if (!el.available) return;
      const link = links[el.sym];
      if (!link) return;
      window.open(link.url, "_blank", "noopener,noreferrer");
    },
    [links]
  );


  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-700">
      <AppNav currentPath="/app/cabinet/shop" customerName={authUser.firstName} unreadCount={unreadCount} />

      <main className="luc-main flex-1 px-8 py-7">
        {/* Enhanced Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="luc-heading text-3xl font-medium mb-1">Shop</h1>
            <p className="text-base text-gray-600">Browse Products by Format</p>
          </div>
          <a
            href="https://luciteria.com"
            target="_blank"
            rel="noreferrer"
            className="text-sm text-gray-600 hover:text-gray-800"
            style={{ textDecoration: "none" }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square mr-1"></i> luciteria.com
          </a>
        </div>

        {/* Prominent Format Selector Card */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 rounded-lg p-5 mb-6 shadow-sm">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center text-white">
              <i className="fa-solid fa-filter text-lg"></i>
            </div>
            <h2 className="text-lg font-semibold text-gray-800">Step 1: Choose Your Preferred Format</h2>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Product Format:</label>
            <div className="relative">
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value || "other")}
                className="border-2 border-blue-300 rounded-lg px-4 py-2.5 text-sm text-gray-700 bg-white appearance-none pr-10 w-[200px] font-medium shadow-sm hover:border-blue-400 transition-colors"
              >
                {formats.map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
              <i className="fa-solid fa-chevron-down absolute right-4 top-3.5 text-sm text-blue-600 pointer-events-none"></i>
            </div>
            <div className="ml-4 flex items-center gap-2">
              <span className="w-3 h-3 rounded-sm bg-green-500 inline-block"></span>
              <span className="text-sm text-gray-600">= Already in your collection</span>
            </div>
          </div>
        </section>

        {/* Helper Text for Table */}
        <div className="mb-3">
          <p className="text-sm text-gray-600 flex items-center gap-2">
            <i className="fa-solid fa-hand-pointer text-blue-500"></i>
            <strong>Step 2: Select an element to view products</strong>
            <span className="text-gray-500">- Click any available element below to open its product page on luciteria.com</span>
          </p>
        </div>

        {/* Periodic table with shop-specific styling */}
        <section className="bg-white border border-gray-300 rounded-lg p-2 md:p-5 shadow-sm">
          <style>{`
            .shop-table .cell {
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
              border-color: #adb5bd;
              transition: all 0.2s ease;
            }
            .shop-table .cell:hover {
              background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%);
              border-color: #2196f3;
              transform: translateY(-2px);
              box-shadow: 0 4px 8px rgba(33, 150, 243, 0.2);
            }
            .shop-table .cell.owned {
              background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
              border-color: #66bb6a;
            }
            .shop-table .cell.owned:hover {
              background: linear-gradient(135deg, #c8e6c9 0%, #a5d6a7 100%);
              border-color: #4caf50;
            }
            .shop-table .cell.unavailable {
              opacity: 0.3;
              cursor: not-allowed;
            }
            .shop-table .cell .sym {
              color: #1976d2;
            }
            .shop-table .cell.owned .sym {
              color: #2e7d32;
            }
          `}</style>
          <div key={selectedFormat} className="shop-table">
            <WireframePeriodicTable
              elements={elements}
              states={tableStates}
              onCellClick={handleCellClick}
            />
          </div>
        </section>
      </main>
    </div>
  );
}