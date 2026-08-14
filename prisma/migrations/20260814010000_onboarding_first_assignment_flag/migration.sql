-- FR-16/FR-17: atomic first-assignment idempotency guard on SubscriptionOnboarding.
-- Ensures the immediate first-assignment trigger and the scheduled Assignment
-- Engine batch never both process the same contract's first cycle.
ALTER TABLE "SubscriptionOnboarding"
  ADD COLUMN "firstAssignmentTriggered" BOOLEAN NOT NULL DEFAULT false;
