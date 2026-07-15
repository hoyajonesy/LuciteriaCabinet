-- CreateTable
CREATE TABLE "AdminUser" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "resetToken" TEXT,
    "resetTokenExpiry" DATETIME
);

-- CreateTable
CREATE TABLE "Format" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionSet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "tier" TEXT NOT NULL DEFAULT 'Free',
    "setType" TEXT NOT NULL DEFAULT 'Starter',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CollectionSetElement" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "setId" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "atomicNumber" INTEGER NOT NULL,
    CONSTRAINT "CollectionSetElement_setId_fkey" FOREIGN KEY ("setId") REFERENCES "CollectionSet" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MilestoneDefinition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT 'collection',
    "icon" TEXT NOT NULL DEFAULT '🏆',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "UserMilestoneAward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "milestoneId" TEXT NOT NULL,
    "awardedBy" TEXT NOT NULL,
    "awardedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "UserMilestoneAward_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "UserMilestoneAward_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "MilestoneDefinition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FreezeLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "frozenBy" TEXT NOT NULL,
    "frozenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unfrozenAt" DATETIME,
    "unfrozenBy" TEXT,
    CONSTRAINT "FreezeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "BulkNotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "segment" TEXT NOT NULL DEFAULT 'all',
    "recipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentBy" TEXT NOT NULL,
    "sentAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "ElementSample" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "acquisitionDate" DATETIME,
    "source" TEXT,
    "pricePaid" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "condition" TEXT,
    "format" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ElementSample_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElementSample_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
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
    "isStaff" BOOLEAN NOT NULL DEFAULT false,
    "tooltipsDismissed" BOOLEAN NOT NULL DEFAULT false,
    "primaryMotivation" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "freezeReason" TEXT,
    "tier" TEXT NOT NULL DEFAULT 'Free',
    "membershipTierId" TEXT,
    "storeCreditBalance" REAL NOT NULL DEFAULT 0,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'NONE',
    CONSTRAINT "User_membershipTierId_fkey" FOREIGN KEY ("membershipTierId") REFERENCES "MembershipTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "id", "isStaff", "isSubscriber", "lastName", "membershipTierId", "onboardingCompleted", "onboardingStep", "passwordHash", "primaryMotivation", "storeCreditBalance", "subscriptionFormat", "subscriptionStatus", "tooltipsDismissed", "trackedFormats", "updatedAt", "userType", "wishlistToken") SELECT "createdAt", "email", "firstName", "id", "isStaff", "isSubscriber", "lastName", "membershipTierId", "onboardingCompleted", "onboardingStep", "passwordHash", "primaryMotivation", "storeCreditBalance", "subscriptionFormat", "subscriptionStatus", "tooltipsDismissed", "trackedFormats", "updatedAt", "userType", "wishlistToken" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_wishlistToken_key" ON "User"("wishlistToken");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_wishlistToken_idx" ON "User"("wishlistToken");
CREATE INDEX "User_membershipTierId_idx" ON "User"("membershipTierId");
CREATE INDEX "User_status_idx" ON "User"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_email_key" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdminUser_resetToken_key" ON "AdminUser"("resetToken");

-- CreateIndex
CREATE INDEX "AdminUser_email_idx" ON "AdminUser"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Format_name_key" ON "Format"("name");

-- CreateIndex
CREATE INDEX "Format_displayOrder_idx" ON "Format"("displayOrder");

-- CreateIndex
CREATE INDEX "CollectionSetElement_setId_idx" ON "CollectionSetElement"("setId");

-- CreateIndex
CREATE UNIQUE INDEX "CollectionSetElement_setId_elementSymbol_key" ON "CollectionSetElement"("setId", "elementSymbol");

-- CreateIndex
CREATE UNIQUE INDEX "MilestoneDefinition_name_key" ON "MilestoneDefinition"("name");

-- CreateIndex
CREATE INDEX "UserMilestoneAward_userId_idx" ON "UserMilestoneAward"("userId");

-- CreateIndex
CREATE INDEX "UserMilestoneAward_milestoneId_idx" ON "UserMilestoneAward"("milestoneId");

-- CreateIndex
CREATE UNIQUE INDEX "UserMilestoneAward_userId_milestoneId_key" ON "UserMilestoneAward"("userId", "milestoneId");

-- CreateIndex
CREATE INDEX "FreezeLog_userId_idx" ON "FreezeLog"("userId");

-- CreateIndex
CREATE INDEX "BulkNotificationLog_sentAt_idx" ON "BulkNotificationLog"("sentAt");

-- CreateIndex
CREATE INDEX "ElementSample_userId_idx" ON "ElementSample"("userId");

-- CreateIndex
CREATE INDEX "ElementSample_collectionItemId_idx" ON "ElementSample"("collectionItemId");

-- CreateIndex
CREATE INDEX "ElementSample_userId_elementSymbol_idx" ON "ElementSample"("userId", "elementSymbol");
