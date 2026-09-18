/**
 * Staff login diagnostic — run against the REAL database.
 *
 * Answers the exact question: "why does this staff member get 'Invalid
 * Password' after a reset?" It reproduces the server's login check
 * (verifyLogin → bcrypt.compare) directly against the stored row, and reports
 * which step fails — WITHOUT ever printing the password itself.
 *
 * Usage (against production/staging — needs DATABASE_URL in the environment):
 *
 *   EMAIL='tauesjones@gmail.com' PASSWORD='the-password-they-typed' \
 *     node --env-file=.env prisma/verify-staff-login.js
 *
 * Interpreting the result:
 *   - "No user row" ............ the email in the DB differs from what's typed
 *                                (typo/whitespace) → login returns "No account".
 *   - "isStaff = false" ........ account exists but has no admin access.
 *   - "hash present = false" ... the reset never persisted a hash.
 *   - "bcrypt.compare = false" . the stored hash does NOT match this password
 *                                → the password set ≠ the password being typed
 *                                (autofill / typo / trailing space / wrong reset).
 *   - "bcrypt.compare = true" .. the credentials are correct; the problem is
 *                                elsewhere (wrong URL, old deploy, cookie).
 */
import pkg from "@prisma/client";
const { PrismaClient } = pkg;
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function mask(v) {
  if (!v) return "(empty)";
  return `${v.length} char(s)`;
}

async function main() {
  const rawEmail = process.env.EMAIL;
  const password = process.env.PASSWORD;

  if (!rawEmail || !password) {
    console.error("Set EMAIL and PASSWORD env vars. The password is never logged.");
    process.exit(1);
  }

  const email = rawEmail.toLowerCase().trim();
  console.log("\n🔎 Staff login diagnostic");
  console.log("   email (normalised):", email);
  console.log("   password provided :", mask(password), "(value never shown)");
  if (password !== password.trim()) {
    console.log("   ⚠️  password has leading/trailing whitespace — a very common cause.");
  }

  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log("\n❌ No user row for that email.");
    // Surface near-matches so a typo in the stored email is easy to spot.
    const like = await prisma.user.findMany({
      where: { email: { contains: email.split("@")[0].slice(0, 4) } },
      select: { email: true, isStaff: true },
      take: 10,
    });
    if (like.length) {
      console.log("   Similar emails on file:");
      for (const u of like) console.log(`     - ${u.email}  (isStaff=${u.isStaff})`);
    }
    console.log("\n→ Login would return 'No account found with this email.'");
    return;
  }

  console.log("\n✅ User row found:");
  console.log("   id       :", user.id);
  console.log("   email    :", user.email);
  console.log("   isStaff  :", user.isStaff);
  console.log("   status   :", user.status);
  console.log("   hash set :", Boolean(user.passwordHash));
  console.log("   hash algo:", user.passwordHash ? user.passwordHash.slice(0, 4) : "(none)");
  console.log("   updatedAt:", user.updatedAt);

  if (!user.passwordHash) {
    console.log("\n❌ No password hash stored — the reset never persisted. → 'Invalid password.'");
    return;
  }

  const ok = await bcrypt.compare(password, user.passwordHash);
  console.log("\n   bcrypt.compare(typed, storedHash) =", ok);

  if (!ok) {
    console.log("\n❌ The stored hash does NOT match this password.");
    console.log("   → Login returns 'Invalid password.' This means the password that");
    console.log("     was SAVED is not the one being typed now (autofill, a typo, a");
    console.log("     trailing space, or the last reset didn't actually save).");
    console.log("   Fix: reset again and, using the new show/hide eye toggle, confirm");
    console.log("     the SAME visible characters are used to save and to sign in.");
  } else if (!user.isStaff) {
    console.log("\n⚠️  Password is correct BUT isStaff=false → 'This account does not have admin access.'");
  } else {
    console.log("\n✅ Credentials are correct AND isStaff=true.");
    console.log("   If login still fails, the cause is NOT the password: check that");
    console.log("   they use /admin-login (not the storefront), that the deployed build");
    console.log("   is current, and that cookies aren't blocked.");
  }
}

main()
  .catch((e) => {
    console.error("Diagnostic error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
