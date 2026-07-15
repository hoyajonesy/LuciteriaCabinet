/**
 * Luciteria Collector Cabinet — In-App Notification Engine (Phase 2D)
 *
 * Database-backed, preference-aware notification dispatcher. Creates
 * in-app inbox items (Notification model) and respects per-user
 * channel preferences (NotificationPreference model). Email delivery is
 * delegated to the existing email stub in notifications.server.js.
 */

import { prisma } from './db.server.js';
import { sendEmail } from './notifications.server.js';

// Notification categories and which preference fields gate them
export const CATEGORIES = {
  MILESTONE: { inApp: 'inAppMilestone', email: 'emailMilestone', icon: '🏆' },
  NEAR_COMPLETION: { inApp: 'inAppNearCompletion', email: 'emailNearCompletion', icon: '🎯' },
  RESTOCK: { inApp: 'inAppRestock', email: 'emailRestock', icon: '🔔' },
  NEW_ARRIVAL: { inApp: 'inAppNewArrival', email: 'emailNewArrival', icon: '✨' },
  SYSTEM: { inApp: null, email: null, icon: '⚙️' },
  ADMIN: { inApp: null, email: null, icon: '📣' },
};

/**
 * Get (or lazily create) a user's notification preferences.
 */
export async function getPreferences(userId) {
  let pref = await prisma.notificationPreference.findUnique({ where: { userId } });
  if (!pref) {
    pref = await prisma.notificationPreference.create({ data: { userId } });
  }
  return pref;
}

/**
 * Update a user's notification preferences.
 */
export async function updatePreferences(userId, data) {
  await getPreferences(userId); // ensure exists
  return prisma.notificationPreference.update({
    where: { userId },
    data,
  });
}

/**
 * Core dispatcher. Creates an in-app notification (if enabled) and
 * optionally an email (stubbed). De-duplicates via dedupeKey.
 *
 * @returns {Object|null} the created notification, or null if suppressed.
 */
export async function notify(userId, { category, title, body, linkUrl = null, dedupeKey = null, icon = null, email = null }) {
  const cat = CATEGORIES[category] || CATEGORIES.SYSTEM;
  const pref = await getPreferences(userId);

  // Honor global mute
  if (pref.mutedUntil && new Date(pref.mutedUntil) > new Date()) {
    return null;
  }

  // De-dupe
  if (dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: { userId, dedupeKey },
    });
    if (existing) return existing;
  }

  // In-app delivery (SYSTEM/ADMIN always deliver in-app)
  const inAppEnabled = cat.inApp ? pref[cat.inApp] !== false : true;
  let notification = null;
  if (inAppEnabled) {
    notification = await prisma.notification.create({
      data: {
        userId,
        category,
        title,
        body,
        linkUrl,
        icon: icon || cat.icon,
        dedupeKey,
      },
    });
  }

  // Email delivery (stub) — gated by preference + a provided email payload
  const emailEnabled = cat.email ? pref[cat.email] === true : false;
  if (emailEnabled && email && email.to) {
    try {
      await sendEmail({
        to: email.to,
        subject: email.subject || title,
        template: email.template || `notification_${category.toLowerCase()}`,
        data: { title, body, linkUrl, ...(email.data || {}) },
        customerId: userId,
      });
    } catch (err) {
      // Email is best-effort in the prototype
      console.warn('[notify] email stub failed:', err.message);
    }
  }

  return notification;
}

/**
 * Convenience: dispatch a milestone notification.
 */
export async function notifyMilestone(userId, milestone, userEmail = null) {
  return notify(userId, {
    category: 'MILESTONE',
    title: `Milestone unlocked: ${milestone.title}`,
    body: milestone.description,
    icon: milestone.icon || '🏆',
    linkUrl: '/app/progress',
    dedupeKey: `milestone:${milestone.type}`,
    email: userEmail ? { to: userEmail } : null,
  });
}

// ─── Inbox queries ──────────────────────────────────────────────

export async function getNotifications(userId, { unreadOnly = false, limit = 50 } = {}) {
  return prisma.notification.findMany({
    where: { userId, ...(unreadOnly ? { isRead: false } : {}) },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}

export async function getUnreadCount(userId) {
  return prisma.notification.count({ where: { userId, isRead: false } });
}

export async function markRead(userId, notificationId) {
  return prisma.notification.updateMany({
    where: { id: notificationId, userId },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function markAllRead(userId) {
  return prisma.notification.updateMany({
    where: { userId, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
}

export async function deleteNotification(userId, notificationId) {
  return prisma.notification.deleteMany({
    where: { id: notificationId, userId },
  });
}
