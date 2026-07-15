/**
 * Luciteria Collector Cabinet — Product Links
 *
 * Loads data/products.csv (the Luciteria Shopify product export) once at startup
 * and builds a map of element-symbol → product URL for each of the 5 formats.
 *
 * Detection strategy (most reliable first):
 *   1. Variant SKU prefix = element symbol, suffix = format
 *        e.g. "Sr2x2" → Strontium, lucite ; "Os10mm" → Osmium, 10mm
 *   2. Title prefix matched against the 118 element names (fallback)
 *
 * Format suffix → app format id:
 *   _amp                 → ampoules
 *   2x2                  → lucite      (50mm acrylic-embedded "Lucite Cube")
 *   25.4mm               → 25.4mm      (1-inch metal cube)
 *   50mm                 → 50mm        (50mm metal cube)
 *   10mm / 10.1mm        → 10mm        (10mm metal cube)
 *
 * When no product exists for an element in the user's chosen format we fall back
 * to a Luciteria search URL:  https://luciteria.com/search?q=<element name>
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { ELEMENTS_118 } from './elements.server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.resolve(__dirname, '../../data/products.csv');

const FORMAT_IDS = ['10mm', '25.4mm', '50mm', 'lucite', 'ampoules'];

// ─── Lookups ──────────────────────────────────────────────────
const SYMBOLS = new Set(ELEMENTS_118.map((e) => e.sym));
// Element names sorted longest-first so "Carbon dioxide" never shadows "Carbon"
const NAME_TO_SYM = ELEMENTS_118
  .map((e) => ({ name: e.name.toLowerCase(), sym: e.sym }))
  .sort((a, b) => b.name.length - a.name.length);
const SYM_TO_NAME = Object.fromEntries(ELEMENTS_118.map((e) => [e.sym, e.name]));

// ─── Robust CSV parser (handles quoted fields w/ embedded newlines) ──
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      // skip blank lines
      if (row.length > 1 || row[0] !== '') rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// Accessory / non-sample products to exclude (display cases, empty boxes, etc.)
const ACCESSORY_TITLE_RE = /(\bbox(es)?\b|\bcase\b|display|stand|holder|\btray\b|\brack\b|sticker|\blabel(ed)?\b|empty|\bbag\b|poster|\bbook\b|gift card)/i;
const ACCESSORY_SKU_RE = /(empty|^box|^case|^stand)/i;

function isAccessory(title, sku) {
  if (ACCESSORY_SKU_RE.test(sku || '')) return true;
  if (ACCESSORY_TITLE_RE.test(title || '')) return true;
  return false;
}

// ─── Format detection from SKU / Title ────────────────────────
function detectFormatFromSku(sku) {
  const s = (sku || '').toLowerCase();
  if (!s) return null;
  if (s.includes('_amp')) return 'ampoules';
  if (s.includes('2x2')) return 'lucite';
  if (s.includes('25.4mm')) return '25.4mm';
  if (s.includes('50mm')) return '50mm';
  if (s.includes('10.1mm') || s.includes('10mm')) return '10mm';
  return null;
}

function detectFormatFromTitle(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('ampoule') || t.includes('ampule')) return 'ampoules';
  if (t.includes('25.4') || t.includes('1-inch') || t.includes('1 inch')) return '25.4mm';
  if (t.includes('50mm')) return '50mm';
  if (t.includes('10mm') || t.includes('10.1')) return '10mm';
  if (t.includes('lucite')) return 'lucite';
  return null;
}

// ─── Element detection from SKU prefix / Title ────────────────
function detectSymbolFromSku(sku) {
  const m = (sku || '').match(/^([A-Za-z]{1,3})/);
  if (!m) return null;
  const cand = m[1];
  // try 2-letter then 1-letter symbol
  for (const len of [2, 1]) {
    const part = cand.slice(0, len);
    if (!part) continue;
    const proper = part[0].toUpperCase() + part.slice(1).toLowerCase();
    if (SYMBOLS.has(proper)) return proper;
  }
  return null;
}

function detectSymbolFromTitle(title) {
  const t = (title || '').toLowerCase().trim();
  for (const { name, sym } of NAME_TO_SYM) {
    if (t === name || t.startsWith(name + ' ') || t.startsWith(name + ',')) {
      return sym;
    }
  }
  return null;
}

// ─── Build the link map once ──────────────────────────────────
// linksByFormat[formatId][sym] = { url, title, inStock, status }
let linksByFormat = null;

function build() {
  const map = {};
  for (const f of FORMAT_IDS) map[f] = {};

  let raw;
  try {
    raw = fs.readFileSync(CSV_PATH, 'utf8');
  } catch (err) {
    console.error('[product-links] could not read products.csv:', err.message);
    linksByFormat = map;
    return;
  }

  const rows = parseCSV(raw);
  if (!rows.length) {
    linksByFormat = map;
    return;
  }

  const header = rows[0].map((h) => h.replace(/^\ufeff/, '').trim());
  const idx = (name) => header.indexOf(name);
  const iTitle = idx('Title');
  const iUrl = idx('URL');
  const iSku = idx('Variant SKU');
  const iQty = idx('Variant Inventory Qty');
  const iStatus = idx('Status');
  const iVariantId = idx('Variant ID');

  for (let r = 1; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length <= iUrl) continue;
    const title = cols[iTitle] || '';
    const url = (cols[iUrl] || '').trim();
    const sku = (cols[iSku] || '').trim();
    if (!url) continue;
    if (isAccessory(title, sku)) continue;

    const sym = detectSymbolFromSku(sku) || detectSymbolFromTitle(title);
    if (!sym) continue;
    const fmt = detectFormatFromSku(sku) || detectFormatFromTitle(title);
    if (!fmt) continue;

    const qty = parseInt(cols[iQty] || '0', 10) || 0;
    const status = (cols[iStatus] || '').toLowerCase();
    const inStock = qty > 0;
    const variantId = iVariantId !== -1 ? (cols[iVariantId] || '').trim() : '';
    const cleanVariantId = variantId.split("/").pop();

    const existing = map[fmt][sym];
    // Prefer an in-stock, active product when several rows match
    if (
      !existing ||
      (inStock && !existing.inStock) ||
      (status === 'active' && existing.status !== 'active' && existing.inStock === inStock)
    ) {
      map[fmt][sym] = { url, title, inStock, status, variantId: cleanVariantId };
    }
  }

  linksByFormat = map;
}

function ensureBuilt() {
  if (!linksByFormat) build();
  return linksByFormat;
}

function normalizeFormatId(formatId) {
  if (!formatId) return 'lucite';
  const mapping = {
    '10mm_cube': '10mm',
    '25.4mm_cube': '25.4mm',
    '50mm_cube': '50mm',
    'lucite_cube': 'lucite',
    'ampule': 'ampoules',
    '10mm': '10mm',
    '25.4mm': '25.4mm',
    '50mm': '50mm',
    'lucite': 'lucite',
    'ampoules': 'ampoules'
  };
  return mapping[formatId] || 'lucite';
}

// ─── Public API ───────────────────────────────────────────────

/**
 * Build the fallback Luciteria search URL for an element.
 */
export function searchFallbackUrl(elementName) {
  return `https://luciteria.com/search?q=${encodeURIComponent(elementName || '')}`;
}

export function getProductLink(sym, formatId, elementName) {
  const map = ensureBuilt();
  const fmt = normalizeFormatId(formatId);
  const hit = map[fmt] && map[fmt][sym];
  const name = elementName || SYM_TO_NAME[sym] || sym;
  if (hit) {
    const separator = hit.url.includes('?') ? '&' : '?';
    const variantQuery = hit.variantId ? `${separator}variant=${hit.variantId}` : '';
    return { url: `${hit.url}${variantQuery}`, inStock: !!hit.inStock, isFallback: false, title: hit.title };
  }
  return { url: searchFallbackUrl(name), inStock: false, isFallback: true, title: null };
}

/**
 * Get a product link, preferring `formatId`. If that format has no product for
 * the element, cascade through the other formats (closest-available) before
 * finally falling back to a Luciteria search URL.
 *
 * Cascade order after the preferred format: 10mm → 25.4mm → 50mm → lucite → ampoules.
 * @returns {{ url, inStock, isFallback, title, format }} — `format` is the format actually linked.
 */
export function getProductLinkWithFallback(sym, formatId, elementName) {
  const map = ensureBuilt();
  const preferred = normalizeFormatId(formatId);
  const order = [preferred, ...FORMAT_IDS.filter((f) => f !== preferred)];
  const name = elementName || SYM_TO_NAME[sym] || sym;
  for (const fmt of order) {
    const hit = map[fmt] && map[fmt][sym];
    if (hit) {
      const separator = hit.url.includes('?') ? '&' : '?';
      const variantQuery = hit.variantId ? `${separator}variant=${hit.variantId}` : '';
      return { url: `${hit.url}${variantQuery}`, inStock: !!hit.inStock, isFallback: false, title: hit.title, format: fmt };
    }
  }
  return { url: searchFallbackUrl(name), inStock: false, isFallback: true, title: null, format: preferred };
}

/**
 * Get a plain map of { sym: { url, inStock, isFallback } } for every element
 * in the periodic table for a given format. Safe to pass to client components.
 */
export function getAllProductLinks(formatId) {
  const fmt = normalizeFormatId(formatId);
  const out = {};
  for (const el of ELEMENTS_118) {
    out[el.sym] = getProductLink(el.sym, fmt, el.name);
  }
  return out;
}

/**
 * Coverage stats for diagnostics.
 */
export function getProductLinkStats() {
  const map = ensureBuilt();
  const stats = {};
  for (const f of FORMAT_IDS) {
    stats[f] = Object.keys(map[f] || {}).length;
  }
  return stats;
}
