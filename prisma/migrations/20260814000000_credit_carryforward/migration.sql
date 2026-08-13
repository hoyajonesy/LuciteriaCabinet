-- Add subscription carry-forward credit tracking fields (FR-21)
ALTER TABLE "CreditTransaction" ADD COLUMN "subscriptionContractId" TEXT;
ALTER TABLE "CreditTransaction" ADD COLUMN "billingCycle" TEXT;

-- Add unique constraint for idempotent carry-forward credits
CREATE UNIQUE INDEX "subscription_cycle_credit" ON "CreditTransaction"("subscriptionContractId", "billingCycle") WHERE "subscriptionContractId" IS NOT NULL AND "billingCycle" IS NOT NULL;
