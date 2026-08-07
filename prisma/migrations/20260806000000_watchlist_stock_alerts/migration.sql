-- Migration: watchlist_stock_alerts
-- Watchlist stock notifications feature:
--   - Product.lastKnownInventory: last inventory level watchlist users were
--     notified about, used to detect stock transitions (out-of-stock / back-in-stock).
--   - NotificationPreference.watchlistAlerts: per-user opt-in for watchlist
--     in-app + email stock alerts.

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "lastKnownInventory" INTEGER NOT NULL DEFAULT 0;

-- Backfill: seed lastKnownInventory with the current inventory so existing
-- products don't trigger a spurious transition on the next inventory webhook.
UPDATE "Product" SET "lastKnownInventory" = "inventoryQty";

-- AlterTable
ALTER TABLE "NotificationPreference" ADD COLUMN     "watchlistAlerts" BOOLEAN NOT NULL DEFAULT true;
