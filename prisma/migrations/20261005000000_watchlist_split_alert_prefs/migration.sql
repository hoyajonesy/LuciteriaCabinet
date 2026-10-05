-- FR-7.1 / FR-7.2: split watchlistAlerts into per-channel, per-event-type fields
ALTER TABLE "NotificationPreference"
  ADD COLUMN IF NOT EXISTS "watchlistEmailAlerts"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "watchlistInAppAlerts"      BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "watchlistEmailBackInStock"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "watchlistEmailOutOfStock"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "watchlistInAppBackInStock"  BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "watchlistInAppOutOfStock"   BOOLEAN NOT NULL DEFAULT true;

-- Existing users keep their current behavior (migrate from watchlistAlerts)
UPDATE "NotificationPreference"
SET
  "watchlistEmailAlerts"     = "watchlistAlerts",
  "watchlistInAppAlerts"     = "watchlistAlerts",
  "watchlistEmailBackInStock" = "watchlistAlerts",
  "watchlistEmailOutOfStock"  = "watchlistAlerts",
  "watchlistInAppBackInStock" = "watchlistAlerts",
  "watchlistInAppOutOfStock"  = "watchlistAlerts";
