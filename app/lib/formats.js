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
  'ampule':      { id: 'ampule',      name: 'ampule',                   icon: '🧪', sortOrder: 6, description: 'Sealed glass ampoule' },
  'other':       { id: 'other',       name: 'Other',                    icon: '📦', sortOrder: 7, description: 'Other formats' },
};

export const FORMAT_LIST = Object.values(FORMATS).sort((a, b) => a.sortOrder - b.sortOrder);
export const FORMAT_IDS  = FORMAT_LIST.map(f => f.id);

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
