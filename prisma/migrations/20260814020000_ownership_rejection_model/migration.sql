-- v1.3 §4.3 / FR-6: dedicated OwnershipRejection persistence model.
-- A rejection ("subscriber does NOT own this") is a distinct assertion from
-- ownership and MUST be persisted separately from the ownership record.
CREATE TABLE "OwnershipRejection" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "ownableUnitId" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT NOT NULL DEFAULT 'ONBOARDING_DECLINED',
    "sourceSubscriptionContractId" TEXT,
    "supersededAt" TIMESTAMP(3),
    "supersededBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OwnershipRejection_pkey" PRIMARY KEY ("id")
);

-- Secondary indexes for lookups.
CREATE INDEX "OwnershipRejection_userId_idx" ON "OwnershipRejection"("userId");
CREATE INDEX "OwnershipRejection_userId_ownableUnitId_idx" ON "OwnershipRejection"("userId", "ownableUnitId");
CREATE INDEX "OwnershipRejection_supersededAt_idx" ON "OwnershipRejection"("supersededAt");
CREATE INDEX "OwnershipRejection_sourceSubscriptionContractId_idx" ON "OwnershipRejection"("sourceSubscriptionContractId");

-- FR-6: (userId, ownableUnitId) MUST be unique among ACTIVE rejections
-- (supersededAt IS NULL), enforced at the DB level via a partial unique index.
-- A superseded rejection no longer participates in this constraint, so the same
-- unit can be re-rejected later after a confirmation reversed the prior one.
CREATE UNIQUE INDEX "OwnershipRejection_active_user_unit_key"
  ON "OwnershipRejection"("userId", "ownableUnitId")
  WHERE "supersededAt" IS NULL;

-- FK to User with cascade delete (matches Prisma relation onDelete: Cascade).
ALTER TABLE "OwnershipRejection"
  ADD CONSTRAINT "OwnershipRejection_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
