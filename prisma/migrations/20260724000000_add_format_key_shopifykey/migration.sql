-- Migration: add_format_key_shopifykey
-- Make the admin Format table the single source of truth for collection formats.
--   key        stable machine value stored on user prefs & samples (never shown)
--   shopifyKey optional mapping to a Shopify `periodic_size` value; when set the
--              format is "purchasable" (resolves to live products / price / stock)
--
-- IMPORTANT (existing data): a plain `ADD COLUMN "key" ... DEFAULT ''` would give
-- every existing row the same empty key and break the UNIQUE index. This migration
-- therefore backfills canonical keys BEFORE creating the unique index. The explicit
-- UPDATEs mirror prisma/seed-formats.js so the keys match the values already stored
-- on user.subscriptionFormat / user.trackedFormats / Sample.format
-- (e.g. "lucite", "10mm", "ampoules", "other").

-- AlterTable
ALTER TABLE "Format" ADD COLUMN     "key" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "shopifyKey" TEXT;

-- Backfill canonical keys + Shopify mappings for the standard formats (by name)
UPDATE "Format" SET "key" = 'lucite',    "shopifyKey" = 'lucite_cube' WHERE "name" = 'Lucite Cube' AND "key" = '';
UPDATE "Format" SET "key" = '10mm',      "shopifyKey" = '10mm_cube'   WHERE "name" = '10mm Cube'   AND "key" = '';
UPDATE "Format" SET "key" = '25.4mm',    "shopifyKey" = '25.4mm_cube' WHERE "name" = '1 inch Cube' AND "key" = '';
UPDATE "Format" SET "key" = 'ampoules',  "shopifyKey" = 'ampule'      WHERE "name" = 'Ampoule'     AND "key" = '';
UPDATE "Format" SET "key" = 'foil'       WHERE "name" = 'Foil'      AND "key" = '';
UPDATE "Format" SET "key" = 'wire'       WHERE "name" = 'Wire'      AND "key" = '';
UPDATE "Format" SET "key" = 'crystal'    WHERE "name" = 'Crystal'   AND "key" = '';
UPDATE "Format" SET "key" = 'coin_disc'  WHERE "name" = 'Coin/Disc' AND "key" = '';
UPDATE "Format" SET "key" = 'other'      WHERE "name" = 'Other'     AND "key" = '';

-- Backfill any remaining custom formats from a url-safe slug of their name
UPDATE "Format"
  SET "key" = trim(both '_' from lower(regexp_replace("name", '[^a-zA-Z0-9]+', '_', 'g')))
  WHERE "key" = '';

-- Disambiguate any leftover empty/duplicate keys by suffixing part of the id
UPDATE "Format" f
  SET "key" = (CASE WHEN f."key" = '' THEN 'format' ELSE f."key" END) || '_' || substr(replace(f."id"::text, '-', ''), 1, 6)
  WHERE f."key" = ''
     OR EXISTS (
       SELECT 1 FROM "Format" g
       WHERE g."key" = f."key" AND g."id" <> f."id"
     );

-- CreateIndex
CREATE UNIQUE INDEX "Format_key_key" ON "Format"("key");
