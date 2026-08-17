/**
 * Provision real staff (isStaff=true) User accounts.
 *
 * Idempotent:
 *  - If the user already exists, only ensures isStaff=true (never touches
 *    the existing password, so no one is locked out).
 *  - If the user does not exist, creates it with a bcrypt-hashed password
 *    taken from the ADMIN_SEED_PASSWORD env var.
 *
 * The password is NEVER hardcoded and NEVER logged. Set it before running:
 *   ADMIN_SEED_PASSWORD='...' node --env-file=.env prisma/provision-admins.js
 *
 * After first login each admin should change their password via the app.
 */
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";

const prisma = new PrismaClient();

const ADMINS = [
  { email: "chris@luciteria.com", firstName: "Chris", lastName: "Merola" },
  { email: "chris@thee201group.net", firstName: "Chris", lastName: "Merola" },
];

async function main() {
  console.log("🔑 Provisioning staff (isStaff) users...\n");

  let needsPasswordHash = null; // computed lazily, only when a create is required

  for (const admin of ADMINS) {
    const email = admin.email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({
      where: { email },
      select: { id: true, isStaff: true },
    });

    if (existing) {
      if (!existing.isStaff) {
        await prisma.user.update({ where: { email }, data: { isStaff: true } });
        console.log(`   ✓ ${email} — existing user promoted to isStaff=true`);
      } else {
        console.log(`   ✓ ${email} — already isStaff=true (no change)`);
      }
      continue;
    }

    // Creating a brand-new account — a password is required.
    if (needsPasswordHash === null) {
      const seedPassword = process.env.ADMIN_SEED_PASSWORD;
      if (!seedPassword) {
        throw new Error(
          "ADMIN_SEED_PASSWORD env var is required to create new staff accounts. " +
            "Set it before running (it is never logged)."
        );
      }
      needsPasswordHash = await bcrypt.hash(seedPassword, 10);
    }

    await prisma.user.create({
      data: {
        email,
        passwordHash: needsPasswordHash,
        firstName: admin.firstName,
        lastName: admin.lastName,
        isStaff: true,
        onboardingCompleted: true,
        onboardingStep: 5,
        wishlistToken: uuidv4(),
      },
    });
    console.log(`   ✓ ${email} — created (isStaff=true)`);
  }

  console.log("\n✅ Staff provisioning complete.");
}

main()
  .catch((e) => {
    console.error("Provisioning error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
