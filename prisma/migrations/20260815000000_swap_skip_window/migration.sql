-- Subscription Swap & Skip Window (feature_swap_skip_window)
-- FRD v1.2. All new columns are nullable / defaulted so the migration is safe
-- to apply while the feature flag is OFF (existing rows are unaffected and the
-- feature code paths are gated behind `feature_swap_skip_window`).

-- ─── SubscriptionShipment: decision-window fields ─────────────
-- `status` remains free-text; the new "held_for_swap" value needs no enum change.
ALTER TABLE "SubscriptionShipment"
  ADD COLUMN "windowOpensAt" TIMESTAMP(3),
  ADD COLUMN "windowExpiresAt" TIMESTAMP(3),
  ADD COLUMN "windowRemainingSeconds" INTEGER,
  ADD COLUMN "swapDecision" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN "originalProductId" TEXT,
  ADD COLUMN "decidedAt" TIMESTAMP(3),
  ADD COLUMN "finalizationClaimed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "appliedWindowLengthDays" INTEGER,
  ADD COLUMN "appliedSwapFinalizesImmediately" BOOLEAN;

CREATE INDEX "SubscriptionShipment_windowExpiresAt_idx" ON "SubscriptionShipment"("windowExpiresAt");

-- ─── CreditTransaction: skip-credit expiry ────────────────────
ALTER TABLE "CreditTransaction"
  ADD COLUMN "expiresAt" TIMESTAMP(3);

CREATE INDEX "CreditTransaction_expiresAt_idx" ON "CreditTransaction"("expiresAt");

-- ─── ShipmentSwapEvent: audit trail of window decisions ───────
CREATE TABLE "ShipmentSwapEvent" (
    "id" TEXT NOT NULL,
    "shipmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "fromProductId" TEXT,
    "toProductId" TEXT,
    "userId" TEXT,
    "staffId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ShipmentSwapEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ShipmentSwapEvent_shipmentId_idx" ON "ShipmentSwapEvent"("shipmentId");
CREATE INDEX "ShipmentSwapEvent_action_idx" ON "ShipmentSwapEvent"("action");
CREATE INDEX "ShipmentSwapEvent_createdAt_idx" ON "ShipmentSwapEvent"("createdAt");

ALTER TABLE "ShipmentSwapEvent"
  ADD CONSTRAINT "ShipmentSwapEvent_shipmentId_fkey"
  FOREIGN KEY ("shipmentId") REFERENCES "SubscriptionShipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ─── SwapWindowSettings: singleton configuration ──────────────
-- Starting values match the FRD proposed defaults. The row is created lazily by
-- the app layer (id = 'singleton'); defaults here keep DB-level inserts correct.
CREATE TABLE "SwapWindowSettings" (
    "id" TEXT NOT NULL,
    "windowLengthDays" INTEGER NOT NULL DEFAULT 6,
    "swapFinalizesImmediately" BOOLEAN NOT NULL DEFAULT true,
    "allowMultipleDecisionChanges" BOOLEAN NOT NULL DEFAULT false,
    "firstShipmentGetsWindow" BOOLEAN NOT NULL DEFAULT true,
    "backstopAssignmentGetsWindow" BOOLEAN NOT NULL DEFAULT true,
    "skipCreditStackableWithTierCredit" BOOLEAN NOT NULL DEFAULT true,
    "skipCreditRefundOnCancellation" BOOLEAN NOT NULL DEFAULT false,
    "skipCreditRedeemableAtCheckout" BOOLEAN NOT NULL DEFAULT false,
    "skipCreditExpiryDays" INTEGER,
    "skipCreditPostCancellationDays" INTEGER NOT NULL DEFAULT 90,
    "updatedByAdminUserId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SwapWindowSettings_pkey" PRIMARY KEY ("id")
);

-- ─── SwapWindowSettingsAudit: field-level change history ──────
CREATE TABLE "SwapWindowSettingsAudit" (
    "id" TEXT NOT NULL,
    "adminUserId" TEXT NOT NULL,
    "settingField" TEXT NOT NULL,
    "oldValue" TEXT,
    "newValue" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SwapWindowSettingsAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SwapWindowSettingsAudit_adminUserId_idx" ON "SwapWindowSettingsAudit"("adminUserId");
CREATE INDEX "SwapWindowSettingsAudit_changedAt_idx" ON "SwapWindowSettingsAudit"("changedAt");
