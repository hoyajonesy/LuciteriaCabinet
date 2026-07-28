-- Migration: passport_featured_multi_format
-- Allow the same element to be featured on a passport once per format
-- (e.g. Fe as a 10mm cube AND Fe as an ampoule). Replaces the
-- (passportId, elementKey) unique index with (passportId, elementKey, format).

-- DropIndex
DROP INDEX IF EXISTS "PassportFeaturedElement_passportId_elementKey_key";

-- CreateIndex
CREATE UNIQUE INDEX "PassportFeaturedElement_passportId_elementKey_format_key"
  ON "PassportFeaturedElement"("passportId", "elementKey", "format");
