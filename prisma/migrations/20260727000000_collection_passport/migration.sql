-- Migration: collection_passport
-- Collection Passport feature (viral growth Option 1):
--   - New public collector profile fields on User (handle, displayName, bio,
--     location, favouriteElement, avatarUrl)
--   - CollectorPassport: one shareable published profile per account
--   - PassportFeaturedElement: up to 5 curated owned elements per passport

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "handle" TEXT,
ADD COLUMN     "displayName" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "favouriteElement" TEXT,
ADD COLUMN     "avatarUrl" TEXT;

-- CreateTable
CREATE TABLE "CollectorPassport" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CollectorPassport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PassportFeaturedElement" (
    "id" TEXT NOT NULL,
    "passportId" TEXT NOT NULL,
    "elementKey" TEXT NOT NULL,
    "format" TEXT,
    "displayOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PassportFeaturedElement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_handle_key" ON "User"("handle");

-- CreateIndex
CREATE UNIQUE INDEX "CollectorPassport_userId_key" ON "CollectorPassport"("userId");

-- CreateIndex
CREATE INDEX "CollectorPassport_published_idx" ON "CollectorPassport"("published");

-- CreateIndex
CREATE INDEX "PassportFeaturedElement_passportId_idx" ON "PassportFeaturedElement"("passportId");

-- CreateIndex
CREATE UNIQUE INDEX "PassportFeaturedElement_passportId_elementKey_key" ON "PassportFeaturedElement"("passportId", "elementKey");

-- CreateIndex
CREATE UNIQUE INDEX "PassportFeaturedElement_passportId_displayOrder_key" ON "PassportFeaturedElement"("passportId", "displayOrder");

-- AddForeignKey
ALTER TABLE "CollectorPassport" ADD CONSTRAINT "CollectorPassport_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PassportFeaturedElement" ADD CONSTRAINT "PassportFeaturedElement_passportId_fkey" FOREIGN KEY ("passportId") REFERENCES "CollectorPassport"("id") ON DELETE CASCADE ON UPDATE CASCADE;
