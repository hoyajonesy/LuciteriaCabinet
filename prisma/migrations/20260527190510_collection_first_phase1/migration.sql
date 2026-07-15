-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "isSubscriber" BOOLEAN NOT NULL DEFAULT false,
    "subscriptionFormat" TEXT,
    "trackedFormats" TEXT NOT NULL DEFAULT '[]',
    "onboardingCompleted" BOOLEAN NOT NULL DEFAULT false,
    "onboardingStep" INTEGER NOT NULL DEFAULT 1,
    "wishlistToken" TEXT NOT NULL,
    "userType" TEXT NOT NULL DEFAULT 'collector',
    "tooltipsDismissed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "membershipTierId" TEXT,
    "storeCreditBalance" REAL NOT NULL DEFAULT 0,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'NONE',
    CONSTRAINT "User_membershipTierId_fkey" FOREIGN KEY ("membershipTierId") REFERENCES "MembershipTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "atomicNumber" INTEGER NOT NULL,
    "format" TEXT,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserElement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "UserWishlistElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "atomicNumber" INTEGER NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserWishlistElement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyId" TEXT,
    "shopifyCustomerId" TEXT,
    "email" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "collectionType" TEXT NOT NULL DEFAULT 'lucite',
    "onboardedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shopifyProductId" TEXT,
    "shopifyVariantId" TEXT,
    "shopifyInventoryItemId" TEXT,
    "handle" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "sku" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "atomicNumber" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "collectionTypes" TEXT NOT NULL DEFAULT '[]',
    "status" TEXT NOT NULL DEFAULT 'Active',
    "inventoryQty" INTEGER NOT NULL DEFAULT 0,
    "priceUsd" REAL NOT NULL DEFAULT 0,
    "retailPrice" REAL NOT NULL DEFAULT 0,
    "subscriptionCost" REAL,
    "imageUrl" TEXT,
    "rarityTier" TEXT NOT NULL DEFAULT 'common',
    "availableForSubscription" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT NOT NULL DEFAULT '[]',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "acquiredVia" TEXT NOT NULL,
    "acquiredDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "collectionType" TEXT,
    "notes" TEXT,
    CONSTRAINT "CollectionRecord_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CollectionRecord_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WishlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "notifyOnRestock" BOOLEAN NOT NULL DEFAULT false,
    "addedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WishlistItem_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WishlistItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "shopifyContractId" TEXT,
    "planName" TEXT NOT NULL,
    "planTier" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "billingCadence" TEXT NOT NULL,
    "priceUsd" REAL NOT NULL,
    "collectionType" TEXT,
    "originalPrice" REAL,
    "currentPrice" REAL,
    "priceLockedAt" DATETIME,
    "priceExpiresAt" DATETIME,
    "grandfathered" BOOLEAN NOT NULL DEFAULT false,
    "pausedDays" INTEGER NOT NULL DEFAULT 0,
    "nextShipmentDate" DATETIME NOT NULL,
    "nextBillingDate" DATETIME NOT NULL,
    "startDate" DATETIME NOT NULL,
    "pausedAt" DATETIME,
    "cancelledAt" DATETIME,
    "itemsPerShipment" INTEGER NOT NULL DEFAULT 1,
    CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionShipment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subscriptionId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "shopifyOrderId" TEXT,
    "shopifyDraftOrderId" TEXT,
    "shipmentDate" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "trackingNumber" TEXT,
    "trackingUrl" TEXT,
    "trackingCompany" TEXT,
    "assignedBy" TEXT NOT NULL DEFAULT 'auto',
    "retailPrice" REAL,
    "assignedPrice" REAL,
    "discountPercent" REAL,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SubscriptionShipment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SubscriptionShipment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShipmentItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shipmentId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    CONSTRAINT "ShipmentItem_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "SubscriptionShipment" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ShipmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "duplicateHandling" TEXT NOT NULL DEFAULT 'never',
    "preferredCategories" TEXT NOT NULL DEFAULT '[]',
    "excludedCategories" TEXT NOT NULL DEFAULT '[]',
    "preferredFormats" TEXT NOT NULL DEFAULT '[]',
    "budgetMaxUsd" REAL,
    "communicationEmail" BOOLEAN NOT NULL DEFAULT true,
    "communicationSms" BOOLEAN NOT NULL DEFAULT false,
    "shipmentNotifications" BOOLEAN NOT NULL DEFAULT true,
    "restockAlerts" BOOLEAN NOT NULL DEFAULT true,
    "priceChangeAlerts" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CustomerPreference_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AssignmentException" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "resolvedBy" TEXT,
    "resolvedAt" DATETIME,
    "resolution" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AssignmentException_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "prevQty" INTEGER NOT NULL,
    "newQty" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InventoryLog_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AdminNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "authorName" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AdminNote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionTypeChange" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "previousType" TEXT NOT NULL,
    "newType" TEXT NOT NULL,
    "reason" TEXT,
    "changedBy" TEXT NOT NULL DEFAULT 'customer',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CollectionTypeChange_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PricingHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "priceUsd" REAL NOT NULL,
    "retailPrice" REAL NOT NULL,
    "subscriptionCost" REAL,
    "effectiveDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    CONSTRAINT "PricingHistory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT,
    "channel" TEXT NOT NULL,
    "template" TEXT,
    "event" TEXT,
    "subject" TEXT,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'sent',
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "metadata" TEXT,
    CONSTRAINT "NotificationLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WebhookEventLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "topic" TEXT NOT NULL,
    "shopifyId" TEXT,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "errorMsg" TEXT,
    "processedAt" DATETIME,
    "receivedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ShopifySyncStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "resourceType" TEXT NOT NULL,
    "lastSyncAt" DATETIME,
    "lastSyncStatus" TEXT NOT NULL DEFAULT 'never',
    "itemsSynced" INTEGER NOT NULL DEFAULT 0,
    "errorMsg" TEXT,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "MembershipTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "monthlyPrice" REAL NOT NULL,
    "storeCredit" REAL NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "earlyAccessDays" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserSubscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "billingCycle" TEXT NOT NULL,
    "nextBillingDate" DATETIME NOT NULL,
    "canSkipNext" BOOLEAN NOT NULL DEFAULT true,
    "skippedMonths" TEXT NOT NULL DEFAULT '[]',
    "pausedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "UserSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "UserSubscription_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CreditTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "CreditTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SubscriptionSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sku" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "isSubscriberOnly" BOOLEAN NOT NULL DEFAULT false,
    "isEarlyAccess" BOOLEAN NOT NULL DEFAULT false,
    "minTierId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectorPack" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "skuList" TEXT NOT NULL,
    "tierId" TEXT,
    "price" REAL,
    "creditCost" REAL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "stockLimit" INTEGER,
    "imageUrl" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectorPack_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "MembershipTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PackOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "packName" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "paymentMethod" TEXT NOT NULL,
    "creditAmount" REAL NOT NULL DEFAULT 0,
    "cashAmount" REAL NOT NULL DEFAULT 0,
    "skuList" TEXT NOT NULL,
    "adminNotes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "fulfilledAt" DATETIME,
    "rejectedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "UserOwnedSku" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "elementSymbol" TEXT,
    "format" TEXT,
    "acquiredDate" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT NOT NULL,
    CONSTRAINT "UserOwnedSku_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CompletionGoal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goalType" TEXT NOT NULL,
    "targetFormat" TEXT,
    "targetGroup" TEXT,
    "targetCount" INTEGER NOT NULL,
    "currentCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CompletionGoal_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CurationRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "elementCount" INTEGER NOT NULL,
    "cadence" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "approvedBy" TEXT,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FeatureFlag" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "flagName" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "elementName" TEXT NOT NULL,
    "atomicNumber" INTEGER NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'MISSING',
    "format" TEXT,
    "acquiredDate" DATETIME,
    "acquiredVia" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏆',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "earnedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CollectionGoalV2" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "goalType" TEXT NOT NULL,
    "targetFormat" TEXT,
    "targetGroup" TEXT,
    "targetCount" INTEGER,
    "title" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionGoalV2_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "elementSymbol" TEXT,
    "details" TEXT NOT NULL DEFAULT '{}',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_wishlistToken_key" ON "User"("wishlistToken");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_wishlistToken_idx" ON "User"("wishlistToken");

-- CreateIndex
CREATE INDEX "User_membershipTierId_idx" ON "User"("membershipTierId");

-- CreateIndex
CREATE INDEX "UserElement_userId_idx" ON "UserElement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserElement_userId_elementSymbol_key" ON "UserElement"("userId", "elementSymbol");

-- CreateIndex
CREATE INDEX "UserWishlistElement_userId_idx" ON "UserWishlistElement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserWishlistElement_userId_elementSymbol_key" ON "UserWishlistElement"("userId", "elementSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopifyId_key" ON "Customer"("shopifyId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_shopifyCustomerId_key" ON "Customer"("shopifyCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_collectionType_idx" ON "Customer"("collectionType");

-- CreateIndex
CREATE INDEX "Customer_email_idx" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopifyProductId_key" ON "Product"("shopifyProductId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopifyVariantId_key" ON "Product"("shopifyVariantId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_sku_key" ON "Product"("sku");

-- CreateIndex
CREATE INDEX "Product_elementSymbol_idx" ON "Product"("elementSymbol");

-- CreateIndex
CREATE INDEX "Product_atomicNumber_idx" ON "Product"("atomicNumber");

-- CreateIndex
CREATE INDEX "Product_status_idx" ON "Product"("status");

-- CreateIndex
CREATE INDEX "Product_category_idx" ON "Product"("category");

-- CreateIndex
CREATE INDEX "Product_availableForSubscription_status_idx" ON "Product"("availableForSubscription", "status");

-- CreateIndex
CREATE INDEX "CollectionRecord_customerId_idx" ON "CollectionRecord"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionRecord_customerId_productId_key" ON "CollectionRecord"("customerId", "productId");

-- CreateIndex
CREATE INDEX "WishlistItem_customerId_idx" ON "WishlistItem"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "WishlistItem_customerId_productId_key" ON "WishlistItem"("customerId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_customerId_key" ON "Subscription"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_shopifyContractId_key" ON "Subscription"("shopifyContractId");

-- CreateIndex
CREATE INDEX "Subscription_status_idx" ON "Subscription"("status");

-- CreateIndex
CREATE INDEX "Subscription_nextShipmentDate_idx" ON "Subscription"("nextShipmentDate");

-- CreateIndex
CREATE INDEX "Subscription_collectionType_idx" ON "Subscription"("collectionType");

-- CreateIndex
CREATE INDEX "SubscriptionShipment_customerId_idx" ON "SubscriptionShipment"("customerId");

-- CreateIndex
CREATE INDEX "SubscriptionShipment_status_idx" ON "SubscriptionShipment"("status");

-- CreateIndex
CREATE INDEX "SubscriptionShipment_shipmentDate_idx" ON "SubscriptionShipment"("shipmentDate");

-- CreateIndex
CREATE INDEX "ShipmentItem_shipmentId_idx" ON "ShipmentItem"("shipmentId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerPreference_customerId_key" ON "CustomerPreference"("customerId");

-- CreateIndex
CREATE INDEX "AssignmentException_status_idx" ON "AssignmentException"("status");

-- CreateIndex
CREATE INDEX "AssignmentException_customerId_idx" ON "AssignmentException"("customerId");

-- CreateIndex
CREATE INDEX "InventoryLog_productId_idx" ON "InventoryLog"("productId");

-- CreateIndex
CREATE INDEX "InventoryLog_createdAt_idx" ON "InventoryLog"("createdAt");

-- CreateIndex
CREATE INDEX "AdminNote_customerId_idx" ON "AdminNote"("customerId");

-- CreateIndex
CREATE INDEX "CollectionTypeChange_customerId_idx" ON "CollectionTypeChange"("customerId");

-- CreateIndex
CREATE INDEX "PricingHistory_productId_idx" ON "PricingHistory"("productId");

-- CreateIndex
CREATE INDEX "PricingHistory_effectiveDate_idx" ON "PricingHistory"("effectiveDate");

-- CreateIndex
CREATE INDEX "NotificationLog_customerId_idx" ON "NotificationLog"("customerId");

-- CreateIndex
CREATE INDEX "NotificationLog_sentAt_idx" ON "NotificationLog"("sentAt");

-- CreateIndex
CREATE INDEX "NotificationLog_event_idx" ON "NotificationLog"("event");

-- CreateIndex
CREATE INDEX "WebhookEventLog_topic_idx" ON "WebhookEventLog"("topic");

-- CreateIndex
CREATE INDEX "WebhookEventLog_status_idx" ON "WebhookEventLog"("status");

-- CreateIndex
CREATE INDEX "WebhookEventLog_receivedAt_idx" ON "WebhookEventLog"("receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ShopifySyncStatus_resourceType_key" ON "ShopifySyncStatus"("resourceType");

-- CreateIndex
CREATE INDEX "ShopifySyncStatus_resourceType_idx" ON "ShopifySyncStatus"("resourceType");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipTier_name_key" ON "MembershipTier"("name");

-- CreateIndex
CREATE INDEX "MembershipTier_sortOrder_idx" ON "MembershipTier"("sortOrder");

-- CreateIndex
CREATE INDEX "UserSubscription_userId_idx" ON "UserSubscription"("userId");

-- CreateIndex
CREATE INDEX "UserSubscription_status_idx" ON "UserSubscription"("status");

-- CreateIndex
CREATE INDEX "CreditTransaction_userId_idx" ON "CreditTransaction"("userId");

-- CreateIndex
CREATE INDEX "CreditTransaction_type_idx" ON "CreditTransaction"("type");

-- CreateIndex
CREATE INDEX "CreditTransaction_createdAt_idx" ON "CreditTransaction"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SubscriptionSku_sku_key" ON "SubscriptionSku"("sku");

-- CreateIndex
CREATE INDEX "SubscriptionSku_isEligible_idx" ON "SubscriptionSku"("isEligible");

-- CreateIndex
CREATE INDEX "CollectorPack_isActive_idx" ON "CollectorPack"("isActive");

-- CreateIndex
CREATE INDEX "PackOrder_userId_idx" ON "PackOrder"("userId");

-- CreateIndex
CREATE INDEX "PackOrder_status_idx" ON "PackOrder"("status");

-- CreateIndex
CREATE INDEX "UserOwnedSku_userId_idx" ON "UserOwnedSku"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserOwnedSku_userId_sku_key" ON "UserOwnedSku"("userId", "sku");

-- CreateIndex
CREATE INDEX "CompletionGoal_userId_idx" ON "CompletionGoal"("userId");

-- CreateIndex
CREATE INDEX "CurationRequest_userId_idx" ON "CurationRequest"("userId");

-- CreateIndex
CREATE INDEX "CurationRequest_status_idx" ON "CurationRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FeatureFlag_flagName_key" ON "FeatureFlag"("flagName");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_idx" ON "CollectionItem"("userId");

-- CreateIndex
CREATE INDEX "CollectionItem_state_idx" ON "CollectionItem"("state");

-- CreateIndex
CREATE INDEX "CollectionItem_userId_state_idx" ON "CollectionItem"("userId", "state");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionItem_userId_elementSymbol_key" ON "CollectionItem"("userId", "elementSymbol");

-- CreateIndex
CREATE INDEX "Milestone_userId_idx" ON "Milestone"("userId");

-- CreateIndex
CREATE INDEX "Milestone_type_idx" ON "Milestone"("type");

-- CreateIndex
CREATE UNIQUE INDEX "Milestone_userId_type_key" ON "Milestone"("userId", "type");

-- CreateIndex
CREATE INDEX "CollectionGoalV2_userId_idx" ON "CollectionGoalV2"("userId");

-- CreateIndex
CREATE INDEX "CollectionGoalV2_userId_isActive_idx" ON "CollectionGoalV2"("userId", "isActive");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_idx" ON "ActivityLog"("userId");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_action_idx" ON "ActivityLog"("action");
