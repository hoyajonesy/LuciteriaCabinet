-- FR-29: staff manual-complete may record an explicit "no ownership changes
-- confirmed" reason instead of confirming owned items, so the record is never
-- left COMPLETE in an ambiguous state.
ALTER TABLE "SubscriptionOnboarding"
  ADD COLUMN "staffNote" TEXT;
