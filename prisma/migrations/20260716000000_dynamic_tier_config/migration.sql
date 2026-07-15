-- Migration: dynamic_tier_config
-- Enhance SubscriptionTier with full dynamic configuration:
--   pricing (creditValue, discountPercentage), product eligibility
--   (allowedCollectionTypes[]), Shopify identifiers (shopifyProductId),
--   display order, and audit fields (createdBy/updatedBy).

-- AlterTable
ALTER TABLE "SubscriptionTier" ADD COLUMN     "allowedCollectionTypes" TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN     "createdBy" TEXT,
ADD COLUMN     "creditValue" DOUBLE PRECISION,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "discountPercentage" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
ADD COLUMN     "displayOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "shopifyProductId" TEXT,
ADD COLUMN     "updatedBy" TEXT;

-- CreateIndex
CREATE INDEX "SubscriptionTier_appstleSellingPlanId_idx" ON "SubscriptionTier"("appstleSellingPlanId");
