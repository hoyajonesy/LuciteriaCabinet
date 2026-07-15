/**
 * Luciteria Collector Cabinet — Real Product Catalog from SKU Mapping
 *
 * Loads the master SKU mapping (derived from the live Shopify export) and
 * normalises every row into the Product shape the rest of the app expects.
 *
 * The CSV lives at  <project>/data/sku-mapping-master.csv  and is parsed
 * once on server start.  In production this data would come from the
 * Shopify Products API via the integration layer, but during the prototype
 * phase we read the static file so every route gets real element-to-SKU
 * associations, real retail prices, and real stock levels.
 *
 * COLLECTION TYPE NORMALISATION
 * The raw CSV has granular types ("Lucite 50mm", "10mm Cube", etc.).
 * We map them to the five canonical subscription types used in the app:
 *   lucite  → "Lucite 50mm"
 *   10mm    → "10mm Cube"
 *   25.4mm  → "25.4mm Cube"
 *   50mm    → "50mm Cube"
 *   ampoules → "Ampoule"
 *
 * Products outside these five types (bars, bulk, accessories, etc.) are
 * still loaded for the product catalog, but are NOT eligible for
 * subscription assignments.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

// ─── CSV PARSING ────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = join(__dirname, "../../data/sku-mapping-master.csv");

/**
 * Minimal CSV parser — handles quoted fields with commas.
 * No external dependency required.
 */
function parseCSV(text) {
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];

  const parseRow = (line) => {
    const fields = [];
    let current = "";
    let inQuote = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuote && line[i + 1] === '"') { current += '"'; i++; }
        else inQuote = !inQuote;
      } else if (ch === "," && !inQuote) {
        fields.push(current); current = "";
      } else {
        current += ch;
      }
    }
    fields.push(current);
    return fields.map((f) => f.trim());
  };

  const headers = parseRow(lines[0]);
  return lines.slice(1).map((line) => {
    const values = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = values[i] || ""; });
    return obj;
  });
}

// ─── LOAD & NORMALISE ───────────────────────────────────────

let RAW_ROWS = [];
try {
  const csvText = readFileSync(CSV_PATH, "utf-8").replace(/^\uFEFF/, ""); // strip BOM
  RAW_ROWS = parseCSV(csvText);
} catch (err) {
  console.error("[product-catalog] Could not load SKU mapping:", err.message);
  console.error("[product-catalog] Falling back to empty catalog. Prototype will use mock-db instead.");
}

/**
 * Map raw "Collection Type" strings from the CSV to the canonical
 * subscription collection types used in the app UI and assignment engine.
 */
const COLLECTION_TYPE_MAP = {
  "Lucite 50mm": "lucite",
  "10mm Cube": "10mm",
  "25.4mm Cube": "25.4mm",
  "50mm Cube": "50mm",
  "Ampoule": "ampoules",
};

/**
 * Normalise one CSV row into the Product shape.
 *
 * Fields match the Prisma `Product` model so that when we switch from
 * mock data to a real database the shapes are identical.
 */
function normaliseRow(row, index) {
  const rawCollectionType = row["Collection Type"] || "";
  const canonicalType = COLLECTION_TYPE_MAP[rawCollectionType] || null;
  const tags = (row.Tags || "").split(",").map((t) => t.trim()).filter(Boolean);
  const atomicNumber = parseFloat(row["Atomic Number"]) || 0;

  // Derive category from tags
  let category = "Other";
  const formTag = tags.find((t) => t.startsWith("form:"));
  if (formTag) {
    const form = formTag.replace("form:", "");
    if (form === "lucite") category = "Lucite Cube";
    else if (form === "cube") category = "Metal Cube";
    else if (form === "ampoule") category = "Ampoule";
    else if (form === "bar") category = "Metal Bar";
    else if (form === "crystal") category = "Crystal";
    else if (form === "coin") category = "Coin";
    else if (form === "piece") category = "Sample";
    else category = form.charAt(0).toUpperCase() + form.slice(1);
  }

  // Derive rarity from class tag
  let rarityTier = "common";
  const classTag = tags.find((t) => t.startsWith("class:"));
  if (classTag) {
    const cls = classTag.replace("class:", "");
    if (cls === "precious") rarityTier = "rare";
    else if (cls === "exotic") rarityTier = "uncommon";
    else if (cls === "mid") rarityTier = "common";
    else if (cls === "common") rarityTier = "common";
    else if (cls === "reactive") rarityTier = "uncommon";
  }

  // Derive format from size tag or collection type
  let format = "other";
  const sizeTag = tags.find((t) => t.startsWith("size:"));
  if (sizeTag) {
    const size = sizeTag.replace("size:", "");
    if (size === "large") format = "50mm";
    else if (size === "micro") format = "10mm";
    else if (size === "small") format = "25.4mm";
    else if (size === "standard") format = "31mm";
    else if (size === "display") format = "display";
    else format = size;
  }

  const retailPrice = parseFloat(row["Retail Price"]) || 0;
  // Subscription cost estimate: roughly 45-55% of retail (business rule)
  const subscriptionCost = Math.round(retailPrice * 0.48 * 100) / 100;

  return {
    id: `sku_${row.SKU || index}`,
    sku: row.SKU || `UNKNOWN_${index}`,
    title: row["Product Title"] || "Untitled",
    elementSymbol: row["Element Symbol"] || "",
    elementName: row["Element Name"] || "",
    atomicNumber: Math.round(atomicNumber),
    category,
    format,
    status: row.Status || "Active",
    inventoryQty: parseInt(row["Current Stock"], 10) || 0,
    retailPrice,
    subscriptionCost,
    priceUsd: retailPrice, // UI display price
    rarityTier,
    tags,
    rawCollectionType,
    // The canonical collection type for subscription matching
    collectionTypes: canonicalType ? [canonicalType] : [],
    availableForSubscription: row["Available for Subscription"] === "Yes",
    notes: row.Notes || "",
    // Placeholder fields for future Shopify integration
    shopifyProductId: null,   // TODO: populate from Shopify Products API
    shopifyVariantId: null,   // TODO: populate from Shopify Variants API
    handle: "",               // TODO: populate from Shopify handle
    imageUrl: null,           // TODO: populate from Shopify images API
    description: "",          // TODO: populate from Shopify product body_html
  };
}

// Normalised product catalog
const ALL_PRODUCTS = RAW_ROWS.map(normaliseRow);

// Only subscription-eligible products (active, available, in a canonical collection type)
const SUBSCRIPTION_PRODUCTS = ALL_PRODUCTS.filter(
  (p) => p.availableForSubscription && p.status === "Active" && p.collectionTypes.length > 0
);

// ─── COLLECTION TYPE STATS ──────────────────────────────────

/**
 * Compute per-collection-type statistics from real catalog data.
 */
function getCollectionTypeStats() {
  const types = ["lucite", "10mm", "25.4mm", "50mm", "ampoules"];
  return types.map((ct) => {
    const products = SUBSCRIPTION_PRODUCTS.filter((p) => p.collectionTypes.includes(ct));
    const elements = new Set(products.map((p) => p.elementSymbol).filter(Boolean));
    const inStock = products.filter((p) => p.inventoryQty > 0);
    return {
      type: ct,
      totalSkus: products.length,
      uniqueElements: elements.size,
      inStockSkus: inStock.length,
      avgRetailPrice: products.length > 0
        ? Math.round(products.reduce((s, p) => s + p.retailPrice, 0) / products.length * 100) / 100
        : 0,
      totalInventory: products.reduce((s, p) => s + p.inventoryQty, 0),
    };
  });
}

// ─── QUERY FUNCTIONS ────────────────────────────────────────

/**
 * Get all products (full catalog, all collection types).
 * @param {string} [collectionType] - Filter to a single collection type
 * @returns {Array} Product objects
 */
function getCatalogProducts(collectionType) {
  if (collectionType) {
    return ALL_PRODUCTS.filter((p) => p.collectionTypes.includes(collectionType));
  }
  return ALL_PRODUCTS;
}

/**
 * Get only subscription-eligible products.
 * @param {string} [collectionType] - Filter to a single collection type
 * @returns {Array} Product objects
 */
function getSubscriptionProducts(collectionType) {
  if (collectionType) {
    return SUBSCRIPTION_PRODUCTS.filter((p) => p.collectionTypes.includes(collectionType));
  }
  return SUBSCRIPTION_PRODUCTS;
}

/**
 * Find a product by its SKU.
 * @param {string} sku
 * @returns {Object|undefined}
 */
function getProductBySku(sku) {
  return ALL_PRODUCTS.find((p) => p.sku === sku);
}

/**
 * Find a product by its internal ID.
 * @param {string} id
 * @returns {Object|undefined}
 */
function getProductById(id) {
  return ALL_PRODUCTS.find((p) => p.id === id);
}

/**
 * Get unique element symbols available for a collection type.
 * @param {string} collectionType
 * @returns {Set<string>}
 */
function getAvailableElements(collectionType) {
  const products = getSubscriptionProducts(collectionType);
  return new Set(products.map((p) => p.elementSymbol).filter(Boolean));
}

/**
 * Count of unique elements available for a collection type.
 * @param {string} collectionType
 * @returns {number}
 */
function getAvailableElementCount(collectionType) {
  return getAvailableElements(collectionType).size;
}

// ─── EXPORTS ────────────────────────────────────────────────

export {
  ALL_PRODUCTS,
  SUBSCRIPTION_PRODUCTS,
  COLLECTION_TYPE_MAP,
  getCatalogProducts,
  getSubscriptionProducts,
  getProductBySku,
  getProductById,
  getAvailableElements,
  getAvailableElementCount,
  getCollectionTypeStats,
};
