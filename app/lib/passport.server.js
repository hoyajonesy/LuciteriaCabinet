/**
 * Luciteria Collector Cabinet — Collection Passport Service Layer
 *
 * Business logic for the Collection Passport: a shareable, public-facing
 * collector profile (viral growth Option 1). One passport per account.
 *
 * Responsibilities:
 *   - Auto-generate collector handle + display name from account data
 *   - Get / create the user's passport record
 *   - Publish / unpublish a passport
 *   - Manage up to 5 featured (owned) elements
 *   - Compute the public collection stats (owned count, completion %,
 *     sets completed, formats collected)
 *   - Update the account-level profile fields (handle, bio, avatar, etc.)
 *   - Resolve element catalog data (image, name, atomic number) for display
 */

import { prisma } from './db.server.js';
import { ELEMENTS_118 } from '../data/elements.server.js';
import { normaliseFormat, formatLabel, formatIcon } from './formats.js';

export const MAX_FEATURED_ELEMENTS = 5;
export const TOTAL_ELEMENTS = 118;
export const BIO_MAX_LENGTH = 280;
export const LOCATION_MAX_LENGTH = 60;
export const DISPLAY_NAME_MAX_LENGTH = 40;

// ─── Handle & Display Name Generation ───────────────────────────

/**
 * Normalise a raw string into a valid handle slug fragment:
 * lowercase, alphanumeric + hyphens only.
 */
export function normaliseHandle(raw) {
  return String(raw || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-') // non-alphanumerics → hyphen
    .replace(/-+/g, '-') // collapse repeats
    .replace(/^-+|-+$/g, ''); // trim leading/trailing hyphens
}

/**
 * Build the base (pre-collision) handle from a user's account data.
 *   1. `{firstName}{lastNameInitial}` when a first name exists.
 *   2. Otherwise the email prefix with trailing digits stripped.
 */
function baseHandleFor(user) {
  let base = '';
  if (user?.firstName && user.firstName.trim()) {
    const first = user.firstName.trim();
    const lastInitial = (user.lastName || '').trim().charAt(0);
    base = `${first}${lastInitial}`;
  } else if (user?.email) {
    base = String(user.email).split('@')[0].replace(/\d+$/, '');
  }
  base = normaliseHandle(base);
  return base || 'collector';
}

/**
 * Generate a globally-unique collector handle for a user.
 * Appends a short numeric suffix when a collision exists
 * (e.g. sarahk, sarahk-2, sarahk-3 … then a random 4-digit suffix).
 */
export async function generateHandle(user) {
  const base = baseHandleFor(user);

  // First choice: the bare base handle.
  const existing = await prisma.user.findUnique({ where: { handle: base } });
  if (!existing || existing.id === user?.id) return base;

  // Try incrementing suffixes.
  for (let i = 2; i <= 50; i++) {
    const candidate = `${base}-${i}`;
    // eslint-disable-next-line no-await-in-loop
    const clash = await prisma.user.findUnique({ where: { handle: candidate } });
    if (!clash || clash.id === user?.id) return candidate;
  }

  // Fallback: random suffix, retry a few times.
  for (let i = 0; i < 10; i++) {
    const candidate = `${base}-${Math.floor(1000 + Math.random() * 9000)}`;
    // eslint-disable-next-line no-await-in-loop
    const clash = await prisma.user.findUnique({ where: { handle: candidate } });
    if (!clash) return candidate;
  }

  // Last resort: timestamp suffix (practically always unique).
  return `${base}-${Date.now().toString().slice(-6)}`;
}

/**
 * Auto-generate a display name from account data.
 *   1. `{firstName} {lastInitial}.` when a first name exists.
 *   2. Otherwise a capitalised, digit-stripped email prefix.
 */
export function generateDisplayName(user) {
  if (user?.firstName && user.firstName.trim()) {
    const first = user.firstName.trim();
    const lastInitial = (user.lastName || '').trim().charAt(0);
    return lastInitial ? `${first} ${lastInitial.toUpperCase()}.` : first;
  }
  if (user?.email) {
    const prefix = String(user.email).split('@')[0].replace(/\d+/g, '');
    if (prefix) return prefix.charAt(0).toUpperCase() + prefix.slice(1);
  }
  return 'Collector';
}

/**
 * Ensure a user has a handle + display name, generating and persisting them
 * when missing. Returns the (possibly updated) user record.
 */
export async function ensureProfileDefaults(user) {
  if (!user) return user;
  const updates = {};
  if (!user.handle) updates.handle = await generateHandle(user);
  if (!user.displayName) updates.displayName = generateDisplayName(user);

  if (Object.keys(updates).length === 0) return user;

  return prisma.user.update({ where: { id: user.id }, data: updates });
}

// ─── Passport CRUD ──────────────────────────────────────────────

/**
 * Get or create the user's passport record. Also ensures the user has a
 * handle + display name so every account has a shareable URL by default.
 * Returns the passport with its featured elements ordered.
 */
export async function getOrCreatePassport(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error('User not found');

  await ensureProfileDefaults(user);

  let passport = await prisma.collectorPassport.findUnique({
    where: { userId },
    include: { featuredElements: { orderBy: { displayOrder: 'asc' } } },
  });

  if (!passport) {
    passport = await prisma.collectorPassport.create({
      data: { userId },
      include: { featuredElements: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  return passport;
}

/**
 * Fetch a PUBLISHED passport for the public page by handle.
 * Returns null when the handle is unknown or the passport is not published.
 * Includes resolved user profile, featured element catalog data, and stats.
 */
export async function getPassportByHandle(handle) {
  const normalized = normaliseHandle(handle);
  if (!normalized) return null;

  const user = await prisma.user.findUnique({
    where: { handle: normalized },
    include: {
      passport: {
        include: { featuredElements: { orderBy: { displayOrder: 'asc' } } },
      },
    },
  });

  if (!user || !user.passport || !user.passport.published) return null;

  const featured = await resolveFeaturedElements(user.passport.featuredElements);
  const stats = await getCollectionStats(user.id);

  return {
    handle: user.handle,
    displayName: user.displayName || generateDisplayName(user),
    bio: user.bio,
    location: user.location,
    favouriteElement: user.favouriteElement,
    favouriteElementData: user.favouriteElement
      ? resolveElement(user.favouriteElement)
      : null,
    motivation: user.primaryMotivation,
    avatarUrl: user.avatarUrl,
    memberSince: user.createdAt,
    publishedAt: user.passport.publishedAt,
    featuredElements: featured,
    stats,
  };
}

/**
 * Publish the user's passport (creating it if necessary).
 */
export async function publishPassport(userId) {
  await getOrCreatePassport(userId);
  return prisma.collectorPassport.update({
    where: { userId },
    data: { published: true, publishedAt: new Date() },
  });
}

/**
 * Unpublish the user's passport. Configuration is retained.
 */
export async function unpublishPassport(userId) {
  await getOrCreatePassport(userId);
  return prisma.collectorPassport.update({
    where: { userId },
    data: { published: false },
  });
}

// ─── Featured Elements ──────────────────────────────────────────

/**
 * Replace the passport's featured element list.
 * @param {string} passportId
 * @param {Array<{elementKey:string, format?:string, displayOrder:number}>} elements
 */
export async function updateFeaturedElements(passportId, elements) {
  const cleaned = (elements || [])
    .filter((e) => e && e.elementKey)
    .slice(0, MAX_FEATURED_ELEMENTS)
    .map((e, i) => ({
      elementKey: e.elementKey,
      // Store the canonical format id so the same element can be featured in
      // more than one format (e.g. Fe as a cube and Fe as an ampoule).
      format: normaliseFormat(e.format),
      displayOrder: Number.isInteger(e.displayOrder) ? e.displayOrder : i + 1,
    }));

  // De-duplicate by elementKey + format (a specific element-in-a-format may
  // only appear once) and re-sequence displayOrder (1..n) to satisfy the
  // composite unique constraints.
  const seen = new Set();
  const deduped = [];
  for (const el of cleaned) {
    const uid = `${el.elementKey}::${el.format || ''}`;
    if (seen.has(uid)) continue;
    seen.add(uid);
    deduped.push({ ...el, displayOrder: deduped.length + 1 });
  }

  return prisma.$transaction([
    prisma.passportFeaturedElement.deleteMany({ where: { passportId } }),
    ...deduped.map((el) =>
      prisma.passportFeaturedElement.create({
        data: {
          passportId,
          elementKey: el.elementKey,
          format: el.format,
          displayOrder: el.displayOrder,
        },
      })
    ),
  ]);
}

// ─── Collection Stats ───────────────────────────────────────────

/**
 * Compute the public collection statistics for a user (owned items only).
 *   - totalOwned:        distinct owned elements
 *   - completionPercent: (owned / 118) × 100, rounded to 1 decimal
 *   - setsCompleted:     CollectionSets where the user owns every element
 *   - formatsCollected:  distinct owned formats (with display names)
 */
export async function getCollectionStats(userId) {
  const ownedItems = await prisma.collectionItem.findMany({
    where: { userId, state: 'OWNED' },
    select: { elementSymbol: true, format: true },
  });

  const ownedSymbols = new Set(ownedItems.map((i) => i.elementSymbol));
  const totalOwned = ownedSymbols.size;
  const completionPercent =
    Math.round((totalOwned / TOTAL_ELEMENTS) * 1000) / 10;

  // Sets completed: user owns every element of the set.
  const sets = await prisma.collectionSet.findMany({
    where: { isActive: true },
    include: { elements: { select: { elementSymbol: true } } },
  });
  let setsCompleted = 0;
  for (const set of sets) {
    if (set.elements.length === 0) continue;
    const complete = set.elements.every((e) => ownedSymbols.has(e.elementSymbol));
    if (complete) setsCompleted += 1;
  }

  // Formats collected: distinct formats among owned items, normalised so that
  // legacy variants (Other/other, ampoules/ampule, lucite/lucite_cube, …)
  // collapse to a single canonical format.
  const formatIds = [
    ...new Set(ownedItems.map((i) => normaliseFormat(i.format)).filter(Boolean)),
  ];
  const formatsCollected = formatIds.map((id) => ({
    id,
    name: formatLabel(id) || id,
    icon: formatIcon(id),
  }));

  return {
    totalOwned,
    completionPercent,
    setsCompleted,
    formatsCollected,
    totalElements: TOTAL_ELEMENTS,
  };
}

// ─── Profile ────────────────────────────────────────────────────

/**
 * Update account-level profile fields used by the Passport.
 * Only known, whitelisted fields are written. Values are trimmed and
 * length-capped to match the requirements. Handles are normalised and
 * uniqueness-checked.
 *
 * Returns { user, error }. On a handle collision, error is set and no
 * write occurs.
 */
export async function updateProfile(userId, fields) {
  const data = {};

  if (fields.displayName !== undefined) {
    data.displayName =
      String(fields.displayName || '').trim().slice(0, DISPLAY_NAME_MAX_LENGTH) || null;
  }

  if (fields.handle !== undefined) {
    const normalized = normaliseHandle(fields.handle);
    if (!normalized) {
      return { user: null, error: 'Handle must contain letters or numbers.' };
    }
    const clash = await prisma.user.findUnique({ where: { handle: normalized } });
    if (clash && clash.id !== userId) {
      return { user: null, error: 'That handle is already taken. Please choose another.' };
    }
    data.handle = normalized;
  }

  if (fields.bio !== undefined) {
    data.bio = String(fields.bio || '').trim().slice(0, BIO_MAX_LENGTH) || null;
  }

  if (fields.location !== undefined) {
    data.location =
      String(fields.location || '').trim().slice(0, LOCATION_MAX_LENGTH) || null;
  }

  if (fields.favouriteElement !== undefined) {
    const sym = String(fields.favouriteElement || '').trim();
    data.favouriteElement = sym && resolveElement(sym) ? sym : null;
  }

  if (fields.primaryMotivation !== undefined) {
    data.primaryMotivation = String(fields.primaryMotivation || '').trim() || null;
  }

  if (fields.avatarUrl !== undefined) {
    data.avatarUrl = fields.avatarUrl || null;
  }

  const user = await prisma.user.update({ where: { id: userId }, data });
  return { user, error: null };
}

// ─── Element Catalog Helpers ────────────────────────────────────

/**
 * Resolve a single element symbol to its canonical catalog data.
 */
export function resolveElement(symbol) {
  const el = ELEMENTS_118.find((e) => e.sym === symbol);
  if (!el) return null;
  return { symbol: el.sym, name: el.name, atomicNumber: el.z };
}

/**
 * Given the passport's stored featured elements, resolve full display data:
 * name, atomic number, format label, and catalog image (from the Product
 * table, keyed by element symbol) with a graceful no-image fallback.
 */
export async function resolveFeaturedElements(featured) {
  if (!featured || featured.length === 0) return [];

  const symbols = featured.map((f) => f.elementKey);
  const products = await prisma.product.findMany({
    where: { elementSymbol: { in: symbols }, imageUrl: { not: null } },
    select: { elementSymbol: true, imageUrl: true },
  });
  const imageBySymbol = new Map();
  for (const p of products) {
    if (!imageBySymbol.has(p.elementSymbol)) {
      imageBySymbol.set(p.elementSymbol, p.imageUrl);
    }
  }

  return featured.map((f) => {
    const el = resolveElement(f.elementKey);
    const formatId = normaliseFormat(f.format);
    return {
      elementKey: f.elementKey,
      symbol: f.elementKey,
      // Composite identity so the same element can be featured in more than
      // one format without the two cards colliding.
      uid: `${f.elementKey}::${formatId || ''}`,
      name: el?.name || f.elementKey,
      atomicNumber: el?.atomicNumber || null,
      format: formatId,
      formatName: formatLabel(f.format),
      imageUrl: imageBySymbol.get(f.elementKey) || null,
      displayOrder: f.displayOrder,
    };
  });
}

/**
 * Get the collector's owned elements (for the featured-element picker),
 * annotated with catalog image, format, and whether the element is also
 * on the wishlist (WANTED).
 */
export async function getOwnedElementsForPicker(userId) {
  const items = await prisma.collectionItem.findMany({
    where: { userId, state: { in: ['OWNED', 'WANTED'] } },
    select: {
      elementSymbol: true,
      state: true,
      format: true,
      // A collector may own several samples of the same element, each in a
      // different format — these are the real source of "multiple formats".
      samples: { select: { format: true } },
    },
  });

  const ownedItems = items.filter((i) => i.state === 'OWNED');
  const wantedSymbols = new Set(
    items.filter((i) => i.state === 'WANTED').map((i) => i.elementSymbol)
  );

  const symbols = ownedItems.map((i) => i.elementSymbol);
  const products = symbols.length
    ? await prisma.product.findMany({
        where: { elementSymbol: { in: symbols }, imageUrl: { not: null } },
        select: { elementSymbol: true, imageUrl: true },
      })
    : [];
  const imageBySymbol = new Map();
  for (const p of products) {
    if (!imageBySymbol.has(p.elementSymbol)) {
      imageBySymbol.set(p.elementSymbol, p.imageUrl);
    }
  }

  // One entry per distinct element + format combination the collector owns,
  // so a collector who owns the same element in two formats can feature both.
  const byUid = new Map();
  for (const i of ownedItems) {
    const el = resolveElement(i.elementSymbol);
    // Every distinct format the collector owns for this element: the
    // CollectionItem's own format plus any per-sample formats. Normalise and
    // dedupe; if there are no real formats at all, keep a single null entry.
    const rawFormats = [i.format, ...(i.samples || []).map((s) => s.format)];
    const formatIds = [...new Set(rawFormats.map((f) => normaliseFormat(f)).filter(Boolean))];
    const formats = formatIds.length ? formatIds : [null];
    for (const formatId of formats) {
      const uid = `${i.elementSymbol}::${formatId || ''}`;
      if (byUid.has(uid)) continue;
      byUid.set(uid, {
        uid,
        symbol: i.elementSymbol,
        name: el?.name || i.elementSymbol,
        atomicNumber: el?.atomicNumber || 0,
        format: formatId,
        formatName: formatLabel(formatId),
        imageUrl: imageBySymbol.get(i.elementSymbol) || null,
        isWishlisted: wantedSymbols.has(i.elementSymbol),
      });
    }
  }

  return [...byUid.values()].sort(
    (a, b) =>
      a.atomicNumber - b.atomicNumber ||
      (a.formatName || '').localeCompare(b.formatName || '')
  );
}
