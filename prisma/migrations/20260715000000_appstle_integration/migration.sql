-- AlterTable
ALTER TABLE "User" ADD COLUMN     "appstleCustomerId" TEXT,
ADD COLUMN     "shopifyCustomerId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "appstleContractId" TEXT,
ADD COLUMN     "appstleSellingPlanId" TEXT,
ADD COLUMN     "appstleSellingPlanName" TEXT,
ADD COLUMN     "failedBillingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lastBillingAmount" DOUBLE PRECISION,
ADD COLUMN     "lastBillingDate" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "AppstleWebhookLog" (
    "id" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "appstleContractId" TEXT,
    "customerEmail" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMsg" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "maxRetries" INTEGER NOT NULL DEFAULT 3,
    "processedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "idempotencyKey" TEXT,

    CONSTRAINT "AppstleWebhookLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "collectionType" TEXT NOT NULL,
    "appstleSellingPlanId" TEXT,
    "shopifySellingPlanId" TEXT,
    "monthlyPrice" DOUBLE PRECISION NOT NULL,
    "billingInterval" TEXT NOT NULL DEFAULT 'MONTH',
    "billingIntervalCount" INTEGER NOT NULL DEFAULT 1,
    "excludePreciousMetals" BOOLEAN NOT NULL DEFAULT true,
    "maxDiscountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0.20,
    "itemsPerShipment" INTEGER NOT NULL DEFAULT 1,
    "defaultStrategy" TEXT NOT NULL DEFAULT 'wishlist_priority',
    "allowDuplicates" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubscriptionTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "appstleBillingId" TEXT,
    "shopifyOrderId" TEXT,
    "eventType" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "billingDate" TIMESTAMP(3) NOT NULL,
    "nextBillingDate" TIMESTAMP(3),
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BillingEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AssignmentPreview" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sequencePosition" INTEGER NOT NULL,
    "productId" TEXT,
    "productSku" TEXT,
    "productTitle" TEXT,
    "estimatedDate" TIMESTAMP(3) NOT NULL,
    "estimatedDiscount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'preview',
    "shiftedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentPreview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AppstleWebhookLog_idempotencyKey_key" ON "AppstleWebhookLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "AppstleWebhookLog_eventType_idx" ON "AppstleWebhookLog"("eventType");

-- CreateIndex
CREATE INDEX "AppstleWebhookLog_status_idx" ON "AppstleWebhookLog"("status");

-- CreateIndex
CREATE INDEX "AppstleWebhookLog_appstleContractId_idx" ON "AppstleWebhookLog"("appstleContractId");

-- CreateIndex
CREATE INDEX "AppstleWebhookLog_receivedAt_idx" ON "AppstleWebhookLog"("receivedAt");

-- CreateIndex
CREATE INDEX "AppstleWebhookLog_customerEmail_idx" ON "AppstleWebhookLog"("customerEmail");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTier_name_key" ON "SubscriptionTier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTier_appstleSellingPlanId_key" ON "SubscriptionTier"("appstleSellingPlanId");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionTier_shopifySellingPlanId_key" ON "SubscriptionTier"("shopifySellingPlanId");

-- CreateIndex
CREATE INDEX "SubscriptionTier_collectionType_idx" ON "SubscriptionTier"("collectionType");

-- CreateIndex
CREATE INDEX "SubscriptionTier_isActive_idx" ON "SubscriptionTier"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "BillingEvent_appstleBillingId_key" ON "BillingEvent"("appstleBillingId");

-- CreateIndex
CREATE INDEX "BillingEvent_subscriptionId_idx" ON "BillingEvent"("subscriptionId");

-- CreateIndex
CREATE INDEX "BillingEvent_customerId_idx" ON "BillingEvent"("customerId");

-- CreateIndex
CREATE INDEX "BillingEvent_billingDate_idx" ON "BillingEvent"("billingDate");

-- CreateIndex
CREATE INDEX "BillingEvent_eventType_idx" ON "BillingEvent"("eventType");

-- CreateIndex
CREATE INDEX "AssignmentPreview_subscriptionId_idx" ON "AssignmentPreview"("subscriptionId");

-- CreateIndex
CREATE INDEX "AssignmentPreview_customerId_idx" ON "AssignmentPreview"("customerId");

-- CreateIndex
CREATE INDEX "AssignmentPreview_productId_idx" ON "AssignmentPreview"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "AssignmentPreview_subscriptionId_sequencePosition_key" ON "AssignmentPreview"("subscriptionId", "sequencePosition");

-- CreateIndex
CREATE UNIQUE INDEX "User_appstleCustomerId_key" ON "User"("appstleCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "User_shopifyCustomerId_key" ON "User"("shopifyCustomerId");

-- CreateIndex
CREATE INDEX "User_shopifyCustomerId_idx" ON "User"("shopifyCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_appstleContractId_key" ON "Subscription"("appstleContractId");

-- CreateIndex
CREATE INDEX "Subscription_appstleContractId_idx" ON "Subscription"("appstleContractId");

