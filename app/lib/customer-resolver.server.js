/**
 * Luciteria Collector Cabinet — Customer Identity Resolver
 *
 * Phase 1 identity bridge: Shopify/Appstle customer email == Cabinet user email.
 * Given a normalized Appstle webhook payload, find-or-create the matching
 * Cabinet `User` and `Customer` records.
 *
 * See docs/SUBSCRIPTION_ARCHITECTURE.md §3 (Customer Identity Matching).
 */

import crypto from "crypto";
import { prisma } from "./db.server.js";
import { logger } from "./error-handling.server.js";

const MODULE = "customer-resolver";

/**
 * Resolve (find or create) the Cabinet User + Customer for an Appstle payload.
 *
 * @param {import('../integrations/appstle/appstle-types.js').NormalizedAppstlePayload} payload
 * @returns {Promise<import('../integrations/appstle/appstle-types.js').ResolvedCustomer>}
 */
export async function resolveCustomer(payload) {
  const email = payload.customerEmail;
  if (!email) {
    throw new Error("Cannot resolve customer: no customer email in webhook payload");
  }

  const firstName = payload.customerFirstName || "";
  const lastName = payload.customerLastName || "";
  const shopifyCustomerId = payload.shopifyCustomerId || null;
  const appstleCustomerId = payload.appstleCustomerId || null;

  let createdUser = false;
  let createdCustomer = false;

  // ── 1. Find existing Cabinet User by email ────────────────
  let user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    user = await prisma.user.create({
      data: {
        email,
        firstName: firstName || "Collector",
        lastName: lastName || "",
        // No password — this account is managed externally via Appstle/Shopify.
        passwordHash: "APPSTLE_MANAGED",
        wishlistToken: crypto.randomUUID(),
        userType: "subscriber",
        isSubscriber: true,
        subscriptionStatus: "ACTIVE",
        subscriptionFormat: payload.collectionType || null,
        onboardingStep: 1,
        onboardingCompleted: false,
        appstleCustomerId,
        shopifyCustomerId,
      },
    });
    createdUser = true;
    logger.info(MODULE, `Created Cabinet User from Appstle webhook`, { email });
  } else {
    // Existing user — ensure subscription flags + external ids are populated.
    const updates = {};
    if (!user.isSubscriber) updates.isSubscriber = true;
    if (appstleCustomerId && !user.appstleCustomerId) updates.appstleCustomerId = appstleCustomerId;
    if (shopifyCustomerId && !user.shopifyCustomerId) updates.shopifyCustomerId = shopifyCustomerId;
    if (Object.keys(updates).length > 0) {
      // Guard unique constraint clashes (e.g. shopifyCustomerId already used).
      try {
        user = await prisma.user.update({ where: { id: user.id }, data: updates });
      } catch (err) {
        logger.warn(MODULE, `Could not update user linkage fields: ${err.message}`, { email });
      }
    }
  }

  // ── 2. Find existing Customer by email ────────────────────
  let customer = await prisma.customer.findUnique({ where: { email } });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        email,
        firstName: firstName || "Collector",
        lastName: lastName || "",
        displayName: firstName || "Collector",
        shopifyCustomerId,
        collectionType: payload.collectionType || "lucite",
        onboardedAt: new Date(),
      },
    });
    createdCustomer = true;
    logger.info(MODULE, `Created Cabinet Customer from Appstle webhook`, { email });
  } else if (shopifyCustomerId && !customer.shopifyCustomerId) {
    try {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { shopifyCustomerId },
      });
    } catch (err) {
      logger.warn(MODULE, `Could not update customer.shopifyCustomerId: ${err.message}`, { email });
    }
  }

  return { user, customer, createdUser, createdCustomer };
}

/**
 * Sync an email/name change (from a Shopify customers/update webhook) across
 * both the User and Customer records that share that identity.
 *
 * @param {Object} params
 * @param {string} params.oldEmail
 * @param {string} params.newEmail
 * @param {string} [params.firstName]
 * @param {string} [params.lastName]
 */
export async function syncCustomerEmailChange({ oldEmail, newEmail, firstName, lastName }) {
  const from = oldEmail?.toLowerCase().trim();
  const to = newEmail?.toLowerCase().trim();
  if (!from || !to) return { updated: false };

  const data = { email: to };
  if (firstName !== undefined) data.firstName = firstName;
  if (lastName !== undefined) data.lastName = lastName;

  const results = { user: false, customer: false };

  const user = await prisma.user.findUnique({ where: { email: from } });
  if (user) {
    await prisma.user.update({ where: { id: user.id }, data });
    results.user = true;
  }

  const customer = await prisma.customer.findUnique({ where: { email: from } });
  if (customer) {
    await prisma.customer.update({ where: { id: customer.id }, data });
    results.customer = true;
  }

  logger.info(MODULE, `Synced email change ${from} → ${to}`, results);
  return { updated: results.user || results.customer, ...results };
}
