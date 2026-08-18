/**
 * Authentication Utilities
 * 
 * Password hashing, user creation, and login verification.
 * 
 * TODO PRODUCTION: Replace with Shopify OAuth. This entire file becomes
 * unnecessary when authentication is handled by Shopify App Bridge OAuth flow.
 * The developer should:
 *   1. Remove email/password fields from User model
 *   2. Use Shopify session tokens for identity
 *   3. Map Shopify customer IDs to User records
 */
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { v4 as uuidv4 } from "uuid";
import { prisma } from "./db.server.js";
import { createShopifyCustomer } from "../integrations/shopify/shopify-customers.server.js";

const SALT_ROUNDS = 10;

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password) {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Verify a password against a hash
 */
export async function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

/**
 * Create a new user account
 * Returns { user, error }
 */
export async function createUser({ email, password, firstName, lastName }) {
  // Validate inputs
  const errors = validateSignupFields({ email, password, firstName, lastName });
  if (errors) return { user: null, error: errors };

  // Check if user already exists
  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
  if (existing) {
    return { user: null, error: "An account with this email already exists. Please log in." };
  }

  const passwordHash = await hashPassword(password);
  const wishlistToken = uuidv4();

  try {
    // 1. Create local User record
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase().trim(),
        passwordHash,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        wishlistToken,
        onboardingStep: 2, // Move to step 2 after account creation
      },
    });

    // 2. Create Customer in Shopify (returns mock in prototype, real in production)
    const shopifyCustomer = await createShopifyCustomer({
      email,
      firstName,
      lastName,
    });

    // 3. Create local Customer record
    const customer = await prisma.customer.create({
      data: {
        shopifyId: shopifyCustomer.id ? `gid://shopify/Customer/${shopifyCustomer.id}` : null,
        shopifyCustomerId: shopifyCustomer.id ? String(shopifyCustomer.id) : null,
        email: email.toLowerCase().trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        displayName: `${firstName.trim()} ${lastName.trim()}`,
        collectionType: "lucite", // Default type
        onboardedAt: null,
      },
    });

    // 4. Create default CustomerPreference
    await prisma.customerPreference.create({
      data: {
        customerId: customer.id,
        duplicateHandling: "never",
        preferredCategories: "[]",
        excludedCategories: "[]",
        preferredFormats: "[]",
        budgetMaxUsd: null,
        communicationEmail: true,
        communicationSms: false,
        shipmentNotifications: true,
        restockAlerts: true,
        priceChangeAlerts: true,
      },
    });

    return { user, error: null };
  } catch (err) {
    console.error("[Auth] Create user error:", err);
    return { user: null, error: err.message || "Failed to create account. Please try again." };
  }
}

/**
 * Verify login credentials
 * Returns { user, error }
 */
export async function verifyLogin({ email, password }) {
  if (!email || !password) {
    return { user: null, error: "Email and password are required." };
  }

  try {
    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user) {
      return { user: null, error: "No account found with this email." };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return { user: null, error: "Invalid password." };
    }

    return { user, error: null };
  } catch (error) {
    console.error("[Auth] verifyLogin database error:", error);
    return { user: null, error: "Database connection failed. Please try again later." };
  }
}

/**
 * Get user by ID with all related data
 */
export async function getUserById(userId) {
  try {
    return await prisma.user.findUnique({
      where: { id: userId },
      include: {
        ownedElements: { orderBy: { atomicNumber: "asc" } },
        wishlistElements: { orderBy: { priority: "asc" } },
      },
    });
  } catch (error) {
    console.error("[Auth] getUserById database error:", error);
    return null;
  }
}

/**
 * Update user profile fields
 */
export async function updateUser(userId, data) {
  return prisma.user.update({
    where: { id: userId },
    data,
  });
}

/**
 * Update user's password
 */
export async function updatePassword(userId, currentPassword, newPassword) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { success: false, error: "User not found." };

  const valid = await verifyPassword(currentPassword, user.passwordHash);
  if (!valid) return { success: false, error: "Current password is incorrect." };

  if (newPassword.length < 6) return { success: false, error: "New password must be at least 6 characters." };

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });
  return { success: true, error: null };
}

// ─── Password reset (self-service) ───────────────────────────

const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

function hashResetToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Create a password-reset token for the account with this email.
 *
 * Always resolves without revealing whether the email exists (to avoid account
 * enumeration). When a matching account is found, a raw token is returned for
 * the caller to email; only its hash is stored in the database.
 *
 * Returns { rawToken, user } — rawToken/user are null when no account matches.
 */
export async function createPasswordResetToken(email) {
  const normalized = String(email || "").toLowerCase().trim();
  if (!normalized) return { rawToken: null, user: null };

  const user = await prisma.user.findUnique({ where: { email: normalized } });
  if (!user) return { rawToken: null, user: null };

  const rawToken = crypto.randomBytes(32).toString("hex");
  const resetToken = hashResetToken(rawToken);
  const resetTokenExpiry = new Date(Date.now() + RESET_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  return { rawToken, user };
}

/**
 * Look up the user for a raw reset token, validating that it exists and has not
 * expired. Returns the user or null.
 */
export async function getUserByResetToken(rawToken) {
  if (!rawToken) return null;
  const resetToken = hashResetToken(String(rawToken));
  const user = await prisma.user.findUnique({ where: { resetToken } });
  if (!user) return null;
  if (!user.resetTokenExpiry || user.resetTokenExpiry.getTime() < Date.now()) {
    return null;
  }
  return user;
}

/**
 * Reset a password using a valid raw token. Clears the token on success.
 * Returns { success, error }.
 */
export async function resetPasswordWithToken(rawToken, newPassword) {
  const user = await getUserByResetToken(rawToken);
  if (!user) {
    return { success: false, error: "This reset link is invalid or has expired. Please request a new one." };
  }
  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: "New password must be at least 6 characters." };
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, resetToken: null, resetTokenExpiry: null },
  });
  return { success: true, error: null };
}

/**
 * Regenerate wishlist token
 */
export async function regenerateWishlistToken(userId) {
  const newToken = uuidv4();
  return prisma.user.update({
    where: { id: userId },
    data: { wishlistToken: newToken },
  });
}

/**
 * Add elements to user's collection (bulk)
 */
export async function addUserElements(userId, elements) {
  // elements: array of { symbol, name, atomicNumber, format? }
  const operations = elements.map((el) =>
    prisma.userElement.upsert({
      where: { userId_elementSymbol: { userId, elementSymbol: el.symbol } },
      update: {},
      create: {
        userId,
        elementSymbol: el.symbol,
        elementName: el.name,
        atomicNumber: el.atomicNumber,
        format: el.format || null,
      },
    })
  );
  return prisma.$transaction(operations);
}

/**
 * Remove element from user's collection
 */
export async function removeUserElement(userId, elementSymbol) {
  return prisma.userElement.delete({
    where: { userId_elementSymbol: { userId, elementSymbol } },
  }).catch(() => null); // Ignore if not found
}

/**
 * Toggle element in user's wishlist
 */
export async function toggleUserWishlistElement(userId, element) {
  const existing = await prisma.userWishlistElement.findUnique({
    where: { userId_elementSymbol: { userId, elementSymbol: element.symbol } },
  });

  if (existing) {
    await prisma.userWishlistElement.delete({
      where: { id: existing.id },
    });
    return { added: false };
  }

  // Get max priority
  const maxPriority = await prisma.userWishlistElement.findFirst({
    where: { userId },
    orderBy: { priority: "desc" },
    select: { priority: true },
  });

  await prisma.userWishlistElement.create({
    data: {
      userId,
      elementSymbol: element.symbol,
      elementName: element.name,
      atomicNumber: element.atomicNumber,
      priority: (maxPriority?.priority || 0) + 1,
    },
  });
  return { added: true };
}

/**
 * Get user by wishlist token (for public sharing)
 */
export async function getUserByWishlistToken(token) {
  return prisma.user.findUnique({
    where: { wishlistToken: token },
    include: {
      wishlistElements: { orderBy: { priority: "asc" } },
      ownedElements: true,
    },
  });
}

// ─── Validation Helpers ──────────────────────────────────────

function validateSignupFields({ email, password, firstName, lastName }) {
  if (!firstName || firstName.trim().length < 1) return "Please enter your first name.";
  if (!lastName || lastName.trim().length < 1) return "Please enter your last name.";
  if (!email || !email.includes("@")) return "Please enter a valid email address.";
  if (!password || password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

export function validateEmail(email) {
  if (!email) return "Email is required.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return "Please enter a valid email.";
  return null;
}

export function validatePassword(password) {
  if (!password) return "Password is required.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  return null;
}

// ─── Subscription Onboarding Magic Link (FR-12) ─────────────────

const ONBOARDING_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function hashOnboardingToken(rawToken) {
  return crypto.createHash("sha256").update(rawToken).digest("hex");
}

/**
 * Hash a staff password-reset token before it is stored / looked up. Mirrors
 * the onboarding-token precedent: the raw token only ever lives in the emailed
 * link, and the database stores only its SHA-256 hash, so a DB dump cannot be
 * used to mint working admin password-reset links.
 */
export function hashStaffResetToken(rawToken) {
  return crypto.createHash("sha256").update(String(rawToken)).digest("hex");
}

/**
 * Create a single-use onboarding magic-link token for a user, bound to a specific
 * subscription contract (FR-12). Returns { rawToken, user }.
 */
export async function createOnboardingToken(userId, subscriptionContractId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { rawToken: null, user: null };

  const rawToken = crypto.randomBytes(32).toString("hex");
  const onboardingToken = hashOnboardingToken(rawToken);
  const onboardingTokenExpiry = new Date(Date.now() + ONBOARDING_TOKEN_TTL_MS);

  await prisma.user.update({
    where: { id: user.id },
    data: { 
      onboardingToken, 
      onboardingTokenExpiry,
      onboardingContractId: subscriptionContractId 
    },
  });

  return { rawToken, user };
}

/**
 * Look up the user for a raw onboarding token, validating that it exists, has not
 * expired, is bound to the expected contract, and the account is not frozen (FR-12).
 * Returns the user or null.
 */
export async function getUserByOnboardingToken(rawToken, expectedContractId) {
  if (!rawToken) return null;
  const onboardingToken = hashOnboardingToken(String(rawToken));
  const user = await prisma.user.findUnique({ where: { onboardingToken } });
  
  if (!user) return null;
  
  // Time-limited (FR-12)
  if (!user.onboardingTokenExpiry || user.onboardingTokenExpiry.getTime() < Date.now()) {
    return null;
  }
  
  // Bound to specific contract (FR-12)
  if (user.onboardingContractId !== expectedContractId) {
    return null;
  }
  
  // Frozen accounts blocked (FR-12)
  if (user.status === "frozen") {
    return null;
  }
  
  return user;
}

/**
 * Invalidate an onboarding token (called on completion or login, per FR-12).
 */
export async function invalidateOnboardingToken(userId) {
  await prisma.user.update({
    where: { id: userId },
    data: { 
      onboardingToken: null, 
      onboardingTokenExpiry: null,
      onboardingContractId: null 
    },
  });
}
