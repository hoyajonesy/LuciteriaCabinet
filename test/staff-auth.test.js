/**
 * Staff authentication regression tests.
 *
 * Reproduces the reported bug ("newly-added staff member cannot log in with the
 * password set at creation / after a reset") against the REAL password code
 * (hashPassword / verifyPassword / verifyLogin / authenticateStaff), with an
 * in-memory fake User store swapped in for prisma via mock.module.
 *
 * These prove the create → store → reset → verify chain is internally
 * consistent: a password written by the staff-create / reset paths verifies on
 * login, and only through the dedicated staff (isStaff) gate.
 */
import { test, mock } from "node:test";
import assert from "node:assert/strict";
import bcrypt from "bcryptjs";

/* ── in-memory fake prisma (only the bits the auth code touches) ── */
const users = [];

const prisma = {
  user: {
    async findUnique({ where }) {
      if (where.email !== undefined) {
        return users.find((u) => u.email === where.email) || null;
      }
      if (where.id !== undefined) {
        return users.find((u) => u.id === where.id) || null;
      }
      return null;
    },
    async create({ data }) {
      const row = { id: `u_${users.length + 1}`, status: "active", isStaff: false, ...data };
      users.push(row);
      return row;
    },
    async update({ where, data }) {
      const row = users.find((u) => u.id === where.id);
      Object.assign(row, data);
      return row;
    },
  },
};

mock.module("../app/lib/db.server.js", { namedExports: { prisma } });

const auth = await import("../app/lib/auth.server.js");
const staffSession = await import("../app/lib/staff-session.server.js");

/* Helper mirroring the staff-create action's storage (lowercased email + hash). */
async function createStaff({ email, password, isStaff = true }) {
  return prisma.user.create({
    data: {
      email: email.toLowerCase().trim(),
      passwordHash: await auth.hashPassword(password),
      firstName: "Test",
      lastName: "Staff",
      isStaff,
      wishlistToken: `wt_${users.length + 1}`,
    },
  });
}

test("password set at staff-account creation verifies on login", async () => {
  users.length = 0;
  await createStaff({ email: "taeus@example.com", password: "Sup3rSecret!" });

  const { user, error } = await auth.verifyLogin({ email: "taeus@example.com", password: "Sup3rSecret!" });
  assert.equal(error, null);
  assert.ok(user, "correct password should authenticate");
});

test("login normalises email case/whitespace like account creation", async () => {
  users.length = 0;
  await createStaff({ email: "Taeus@Example.com", password: "Sup3rSecret!" });

  // Operator types the email with different casing / stray spaces on login.
  const { user, error } = await auth.verifyLogin({ email: "  TAEUS@example.com  ", password: "Sup3rSecret!" });
  assert.equal(error, null);
  assert.ok(user, "email case/whitespace differences must not block login");
});

test("password updated via reset verifies on the next login", async () => {
  users.length = 0;
  const created = await createStaff({ email: "taeus@example.com", password: "OldPass123" });

  // Reset path (app.admin.staff reset-password action): re-hash + update.
  await prisma.user.update({ where: { id: created.id }, data: { passwordHash: await auth.hashPassword("NewPass456") } });

  const oldTry = await auth.verifyLogin({ email: "taeus@example.com", password: "OldPass123" });
  assert.ok(oldTry.error, "old password must stop working after a reset");

  const newTry = await auth.verifyLogin({ email: "taeus@example.com", password: "NewPass456" });
  assert.equal(newTry.error, null);
  assert.ok(newTry.user, "the new password must authenticate after a reset");
});

test("authenticateStaff accepts a staff account and rejects a non-staff one", async () => {
  users.length = 0;
  await createStaff({ email: "staff@example.com", password: "Sup3rSecret!", isStaff: true });
  await createStaff({ email: "consumer@example.com", password: "Sup3rSecret!", isStaff: false });

  const ok = await staffSession.authenticateStaff("staff@example.com", "Sup3rSecret!");
  assert.equal(ok.error, null);
  assert.ok(ok.user);

  const wrongPw = await staffSession.authenticateStaff("staff@example.com", "nope");
  assert.ok(wrongPw.error, "wrong password rejected");

  const nonStaff = await staffSession.authenticateStaff("consumer@example.com", "Sup3rSecret!");
  assert.ok(nonStaff.error, "valid but non-staff account has no admin access");
  assert.equal(nonStaff.user, null);
});
