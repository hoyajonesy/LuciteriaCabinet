-- SubscriptionOnboarding: Add magic-link fields to User table
ALTER TABLE "User" ADD COLUMN "onboardingToken" TEXT;
ALTER TABLE "User" ADD COLUMN "onboardingTokenExpiry" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "onboardingContractId" TEXT;

-- Create unique index on onboardingToken
CREATE UNIQUE INDEX "User_onboardingToken_key" ON "User"("onboardingToken");
CREATE INDEX "User_onboardingToken_idx" ON "User"("onboardingToken");

-- SubscriptionOnboarding: Extend CollectionItem with per-item ownership provenance.
-- The unique key remains (userId, elementSymbol) — one row per element. Multiple
-- physical specimens/formats are modeled separately via ElementSample.

-- Add provenance fields to CollectionItem
ALTER TABLE "CollectionItem" ADD COLUMN "ownershipSource" TEXT DEFAULT 'MANUAL_CABINET_ENTRY';
ALTER TABLE "CollectionItem" ADD COLUMN "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CollectionItem" ADD COLUMN "subscriberConfirmed" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "CollectionItem" ADD COLUMN "sourceSubscriptionContractId" TEXT;
ALTER TABLE "CollectionItem" ADD COLUMN "rejectedBySubscriber" BOOLEAN NOT NULL DEFAULT false;

-- Add indexes for provenance fields
CREATE INDEX "CollectionItem_sourceSubscriptionContractId_idx" ON "CollectionItem"("sourceSubscriptionContractId");
CREATE INDEX "CollectionItem_ownershipSource_idx" ON "CollectionItem"("ownershipSource");

-- Create SubscriptionOnboarding table
CREATE TABLE "SubscriptionOnboarding" (
    "id" TEXT NOT NULL,
    "subscriptionContractId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "formatTrack" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "seededFromOrderHistory" BOOLEAN NOT NULL DEFAULT false,
    "remindersSent" INTEGER NOT NULL DEFAULT 0,
    "graceExpiresAt" TIMESTAMP(3) NOT NULL,
    "graceRemainingSeconds" INTEGER,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionOnboarding_pkey" PRIMARY KEY ("id")
);

-- Create unique index on subscriptionContractId
CREATE UNIQUE INDEX "SubscriptionOnboarding_subscriptionContractId_key" ON "SubscriptionOnboarding"("subscriptionContractId");

-- Create indexes on SubscriptionOnboarding
CREATE INDEX "SubscriptionOnboarding_userId_idx" ON "SubscriptionOnboarding"("userId");
CREATE INDEX "SubscriptionOnboarding_status_idx" ON "SubscriptionOnboarding"("status");
CREATE INDEX "SubscriptionOnboarding_subscriptionContractId_idx" ON "SubscriptionOnboarding"("subscriptionContractId");
CREATE INDEX "SubscriptionOnboarding_graceExpiresAt_idx" ON "SubscriptionOnboarding"("graceExpiresAt");

-- Add foreign key constraint
ALTER TABLE "SubscriptionOnboarding" ADD CONSTRAINT "SubscriptionOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
