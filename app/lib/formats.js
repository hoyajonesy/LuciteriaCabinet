/**
 * Luciteria Collector Cabinet — Collection Formats (client-safe)
 *
 * Contains only the format definitions and the parseSizes helper.
 * Safe to import in both React components and server loaders.
 *
 * For server-only availability functions (getAvailableElementsForFormat, etc.)
 * that need ELEMENTS_118, import from './formats.server.js'.
 */

// ─── Format Definitions ────────────────────────────────────────
export const FORMATS = {
  '10mm_cube':   { id: '10mm_cube',   name: '10mm Cube',                icon: '⬛', sortOrder: 1, description: 'Small display cube' },
  '10mm_shards': { id: '10mm_shards', name: '10mm Box (Shards/Flakes)', icon: '🔹', sortOrder: 2, description: '10mm box with shards or flakes' },
  '25.4mm_cube': { id: '25.4mm_cube', name: '1-inch Cube',              icon: '🟫', sortOrder: 3, description: 'Standard display cube' },
  '50mm_cube':   { id: '50mm_cube',   name: '50mm Cube',                icon: '🟧', sortOrder: 4, description: 'Large display cube' },
  'lucite_cube': { id: 'lucite_cube', name: 'Lucite Cube',              icon: '💎', sortOrder: 5, description: 'Element embedded in clear acrylic' },
  'ampule':      { id: 'ampule',      name: 'Ampoule',                  icon: '🧪', sortOrder: 6, description: 'Sealed glass ampoule' },
  'other':       { id: 'other',       name: 'Other',                    icon: '📦', sortOrder: 7, description: 'Other formats' },
};

export const FORMAT_LIST = Object.values(FORMATS).sort((a, b) => a.sortOrder - b.sortOrder);
export const FORMAT_IDS  = FORMAT_LIST.map(f => f.id);

/**
 * Aliases for legacy / inconsistent format values that exist in the data
 * (case variants, plurals, shorthand). Keys are compared case-insensitively.
 * Maps each variant to its canonical FORMATS id.
 */
const FORMAT_ALIASES = {
  // 10mm metal cube — Shopify/DB store this as the bare size token "10mm"
  '10mm': '10mm_cube',
  '10.1mm': '10mm_cube',
  '10mm_cubes': '10mm_cube',
  // 10mm box of shards/flakes
  '10mm_flakes': '10mm_shards',
  '10mm_shard': '10mm_shards',
  // 1-inch (25.4mm) metal cube
  '25.4mm': '25.4mm_cube',
  '1inch_cube': '25.4mm_cube',
  '1_inch_cube': '25.4mm_cube',
  '1inch': '25.4mm_cube',
  // 50mm metal cube
  '50mm': '50mm_cube',
  // Lucite (acrylic-embedded) cube — SKU convention uses "2x2"
  'lucite': 'lucite_cube',
  '2x2': 'lucite_cube',
  // Ampoule / ampule spelling & plural variants
  'ampoule': 'ampule',
  'ampoules': 'ampule',
  'ampules': 'ampule',
};

/**
 * Normalise a raw stored format value to its canonical FORMATS id.
 * Handles case variants (Other → other), plurals/shorthand (ampoules → ampule,
 * 10mm → 10mm_cube, lucite → lucite_cube). Returns null for empty input, and
 * the lower-cased raw value when it maps to no known format (so callers can
 * still show a prettified fallback label).
 */
export function normaliseFormat(raw) {
  if (!raw) return null;
  const key = String(raw).trim().toLowerCase();
  if (!key) return null;
  if (FORMATS[key]) return key;              // already canonical (e.g. "other")
  if (FORMAT_ALIASES[key]) return FORMAT_ALIASES[key];
  return key;                                 // unknown — return normalised raw
}

/**
 * Human-friendly display label for any raw stored format value.
 * Uses the canonical FORMATS name when known, otherwise title-cases the raw
 * value. Returns null for empty input.
 */
export function formatLabel(raw) {
  const id = normaliseFormat(raw);
  if (!id) return null;
  if (FORMATS[id]) return FORMATS[id].name;
  return id
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Icon for any raw stored format value (falls back to the generic 📦).
 */
export function formatIcon(raw) {
  const id = normaliseFormat(raw);
  return (id && FORMATS[id]?.icon) || '📦';
}

/**
 * Parse a Shopify periodic_size metafield value.
 * Shopify list metafields are JSON-encoded arrays e.g. '["10mm_cube","lucite_cube"]'.
 * Falls back to treating the raw string as a single value.
 */
export function parseSizes(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [String(parsed)];
  } catch {
    return [raw];
  }
}
