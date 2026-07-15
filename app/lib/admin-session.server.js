/**
 * Admin Session Management — separate from user sessions.
 * Uses its own cookie for admin authentication.
 */
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import bcrypt from "bcryptjs";
import { prisma } from "./db.server.js";
import { v4 as uuidv4 } from "uuid";

const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || "luciteria-admin-secret-key-dev";

const adminSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__luc_admin_session",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
    sameSite: "lax",
    secrets: [ADMIN_SESSION_SECRET],
    secure: process.env.NODE_ENV === "production",
  },
});

export async function getAdminSession(request) {
  return adminSessionStorage.getSession(request.headers.get("Cookie"));
}

export async function commitAdminSession(session) {
  return adminSessionStorage.commitSession(session);
}

export async function destroyAdminSession(session) {
  return adminSessionStorage.destroySession(session);
}

/**
 * Get admin user ID from session
 */
export async function getAdminId(request) {
  const session = await getAdminSession(request);
  return session.get("adminId") || null;
}

/**
 * Require admin authentication — redirect to login if not authenticated
 */
export async function requireAdmin(request) {
  const adminId = await getAdminId(request);
  if (!adminId) throw redirect("/admin/login");

  const admin = await prisma.adminUser.findUnique({
    where: { id: adminId },
    select: { id: true, email: true, name: true },
  });
  if (!admin) throw redirect("/admin/login");

  return admin;
}

/**
 * Authenticate admin with email/password
 */
export async function authenticateAdmin(email, password) {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return null;

  const valid = await bcrypt.compare(password, admin.passwordHash);
  if (!valid) return null;

  return { id: admin.id, email: admin.email, name: admin.name };
}

/**
 * Create admin session and redirect
 */
export async function createAdminSession(adminId, redirectTo = "/admin") {
  const session = await adminSessionStorage.getSession();
  session.set("adminId", adminId);
  return redirect(redirectTo, {
    headers: { "Set-Cookie": await adminSessionStorage.commitSession(session) },
  });
}

/**
 * Admin logout
 */
export async function adminLogout(request) {
  const session = await getAdminSession(request);
  return redirect("/admin/login", {
    headers: { "Set-Cookie": await adminSessionStorage.destroySession(session) },
  });
}

/**
 * Create a new admin user
 */
export async function createAdminUser(name, email, password) {
  const passwordHash = await bcrypt.hash(password, 10);
  return prisma.adminUser.create({
    data: { name, email, passwordHash },
  });
}

/**
 * Generate password reset token
 */
export async function generateResetToken(email) {
  const admin = await prisma.adminUser.findUnique({ where: { email } });
  if (!admin) return null;

  const resetToken = uuidv4();
  const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { resetToken, resetTokenExpiry },
  });

  return { resetToken, email: admin.email, name: admin.name };
}

/**
 * Reset password with token
 */
export async function resetPasswordWithToken(token, newPassword) {
  const admin = await prisma.adminUser.findFirst({
    where: {
      resetToken: token,
      resetTokenExpiry: { gte: new Date() },
    },
  });
  if (!admin) return null;

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.adminUser.update({
    where: { id: admin.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });

  return admin;
}
