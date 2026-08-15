-- Swap & Skip Window: idempotency marker for the skip-credit expiry sweep.
-- Once a credit's remaining value is clawed back, expiredAt is stamped so the
-- sweep never processes the same credit twice.
ALTER TABLE "CreditTransaction" ADD COLUMN "expiredAt" TIMESTAMP(3);
