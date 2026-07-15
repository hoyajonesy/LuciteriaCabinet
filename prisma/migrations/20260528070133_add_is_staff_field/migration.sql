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
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "membershipTierId" TEXT,
    "storeCreditBalance" REAL NOT NULL DEFAULT 0,
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'NONE',
    CONSTRAINT "User_membershipTierId_fkey" FOREIGN KEY ("membershipTierId") REFERENCES "MembershipTier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_User" ("createdAt", "email", "firstName", "id", "isSubscriber", "lastName", "membershipTierId", "onboardingCompleted", "onboardingStep", "passwordHash", "storeCreditBalance", "subscriptionFormat", "subscriptionStatus", "tooltipsDismissed", "trackedFormats", "updatedAt", "userType", "wishlistToken") SELECT "createdAt", "email", "firstName", "id", "isSubscriber", "lastName", "membershipTierId", "onboardingCompleted", "onboardingStep", "passwordHash", "storeCreditBalance", "subscriptionFormat", "subscriptionStatus", "tooltipsDismissed", "trackedFormats", "updatedAt", "userType", "wishlistToken" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_wishlistToken_key" ON "User"("wishlistToken");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE INDEX "User_wishlistToken_idx" ON "User"("wishlistToken");
CREATE INDEX "User_membershipTierId_idx" ON "User"("membershipTierId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
