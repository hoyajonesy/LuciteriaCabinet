-- AlterTable
ALTER TABLE "User" ADD COLUMN "primaryMotivation" TEXT;

-- CreateTable
CREATE TABLE "ElementNote" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "collectionItemId" TEXT NOT NULL,
    "elementSymbol" TEXT NOT NULL,
    "acquisitionDate" DATETIME,
    "source" TEXT,
    "pricePaid" REAL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "condition" TEXT,
    "storageLocation" TEXT,
    "notes" TEXT,
    "isPrivate" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ElementNote_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ElementNote_collectionItemId_fkey" FOREIGN KEY ("collectionItemId") REFERENCES "CollectionItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "linkUrl" TEXT,
    "icon" TEXT NOT NULL DEFAULT '🔔',
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" DATETIME,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "inAppMilestone" BOOLEAN NOT NULL DEFAULT true,
    "inAppNearCompletion" BOOLEAN NOT NULL DEFAULT true,
    "inAppRestock" BOOLEAN NOT NULL DEFAULT true,
    "inAppNewArrival" BOOLEAN NOT NULL DEFAULT true,
    "emailMilestone" BOOLEAN NOT NULL DEFAULT true,
    "emailNearCompletion" BOOLEAN NOT NULL DEFAULT false,
    "emailRestock" BOOLEAN NOT NULL DEFAULT true,
    "emailNewArrival" BOOLEAN NOT NULL DEFAULT false,
    "weeklyDigest" BOOLEAN NOT NULL DEFAULT true,
    "maxEmailsPerWeek" INTEGER NOT NULL DEFAULT 5,
    "mutedUntil" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CollectionItem" (
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
    "priority" INTEGER NOT NULL DEFAULT 0,
    "contextLabel" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CollectionItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_CollectionItem" ("acquiredDate", "acquiredVia", "atomicNumber", "createdAt", "elementName", "elementSymbol", "format", "id", "notes", "state", "updatedAt", "userId") SELECT "acquiredDate", "acquiredVia", "atomicNumber", "createdAt", "elementName", "elementSymbol", "format", "id", "notes", "state", "updatedAt", "userId" FROM "CollectionItem";
DROP TABLE "CollectionItem";
ALTER TABLE "new_CollectionItem" RENAME TO "CollectionItem";
CREATE INDEX "CollectionItem_userId_idx" ON "CollectionItem"("userId");
CREATE INDEX "CollectionItem_state_idx" ON "CollectionItem"("state");
CREATE INDEX "CollectionItem_userId_state_idx" ON "CollectionItem"("userId", "state");
CREATE UNIQUE INDEX "CollectionItem_userId_elementSymbol_key" ON "CollectionItem"("userId", "elementSymbol");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ElementNote_collectionItemId_key" ON "ElementNote"("collectionItemId");

-- CreateIndex
CREATE INDEX "ElementNote_userId_idx" ON "ElementNote"("userId");

-- CreateIndex
CREATE INDEX "ElementNote_collectionItemId_idx" ON "ElementNote"("collectionItemId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_userId_key" ON "NotificationPreference"("userId");
