-- CreateTable
CREATE TABLE "StaffPasswordResetToken" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffPasswordResetToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StaffPasswordResetToken_token_key" ON "StaffPasswordResetToken"("token");

-- CreateIndex
CREATE INDEX "StaffPasswordResetToken_userId_idx" ON "StaffPasswordResetToken"("userId");

-- CreateIndex
CREATE INDEX "StaffPasswordResetToken_token_idx" ON "StaffPasswordResetToken"("token");

-- AddForeignKey
ALTER TABLE "StaffPasswordResetToken" ADD CONSTRAINT "StaffPasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
