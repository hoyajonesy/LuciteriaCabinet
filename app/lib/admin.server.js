/**
 * Admin Service Layer — Phase 2A
 *
 * Data aggregation functions for the admin dashboard.
 * Queries the real Prisma database (CollectionItem, User, ActivityLog, etc.)
 */
import { prisma } from './db.server.js';
import { ELEMENTS_118 } from '../data/elements.server.js';

const TOTAL_ELEMENTS = 118;

// ─── Overview Stats ────────────────────────────────────────────

export async function getAdminOverviewStats() {
  const totalUsers = await prisma.user.count();

  const totalCollections = await prisma.collectionItem.count();

  // Average elements per user (owned only)
  const ownedCounts = await prisma.collectionItem.groupBy({
    by: ['userId'],
    where: { state: 'OWNED' },
    _count: true,
  });
  const avgElementsPerUser = totalUsers > 0
    ? Math.round(ownedCounts.reduce((sum, u) => sum + u._count, 0) / totalUsers)
    : 0;

  // Active users in last 7 days (users with ActivityLog entries)
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const activeUsersResult = await prisma.activityLog.groupBy({
    by: ['userId'],
    where: { createdAt: { gte: sevenDaysAgo } },
  });
  const activeUsers7d = activeUsersResult.length;

  return {
    totalUsers,
    totalCollections,
    avgElementsPerUser,
    activeUsers7d,
  };
}

// ─── Top Collected Elements ────────────────────────────────────

export async function getTopCollectedElements(limit = 10) {
  const totalUsers = await prisma.user.count();

  const grouped = await prisma.collectionItem.groupBy({
    by: ['elementSymbol', 'elementName'],
    where: { state: 'OWNED' },
    _count: true,
    orderBy: { _count: { elementSymbol: 'desc' } },
    take: limit,
  });

  return grouped.map(g => ({
    elementSymbol: g.elementSymbol,
    elementName: g.elementName,
    count: g._count,
    percentage: totalUsers > 0 ? Math.round((g._count / totalUsers) * 100) : 0,
  }));
}

// ─── Top Wanted Elements ───────────────────────────────────────

export async function getTopWantedElements(limit = 10) {
  const grouped = await prisma.collectionItem.groupBy({
    by: ['elementSymbol', 'elementName'],
    where: { state: { in: ['WANTED', 'WATCHLIST'] } },
    _count: true,
    orderBy: { _count: { elementSymbol: 'desc' } },
    take: limit,
  });

  return grouped.map(g => ({
    elementSymbol: g.elementSymbol,
    elementName: g.elementName,
    wishlistCount: g._count,
    inStock: Math.random() > 0.3, // Mock stock status for now
  }));
}

// ─── Recent Activity ───────────────────────────────────────────

export async function getRecentActivity(limit = 10) {
  const activities = await prisma.activityLog.findMany({
    where: {
      action: { in: ['state_changed', 'added_element'] },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      user: { select: { firstName: true, lastName: true } },
    },
  });

  return activities.map(a => {
    let details = {};
    try { details = JSON.parse(a.details || '{}'); } catch { /* ignore */ }
    const element = ELEMENTS_118.find(el => el.sym === a.elementSymbol);
    return {
      id: a.id,
      userName: `${a.user.firstName} ${a.user.lastName}`,
      elementName: element?.name || a.elementSymbol || 'Unknown',
      elementSymbol: a.elementSymbol || '?',
      action: a.action,
      details,
      date: a.createdAt.toISOString(),
    };
  });
}

// ─── User List with Collection Stats ───────────────────────────

export async function getAllUsersWithCollectionStats() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      isStaff: true,
      userType: true,
      status: true,
      freezeReason: true,
      tier: true,
      createdAt: true,
      collectionItems: {
        where: { state: 'OWNED' },
        select: { id: true },
      },
      activityLogs: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true },
      },
      subscriptionOnboardings: {
        orderBy: { createdAt: 'desc' },
        select: { status: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  return users.map(u => {
    // Surface the most recent onboarding's status for list filtering (FR-27).
    const onboardings = u.subscriptionOnboardings || [];
    const onboardingStatus = onboardings.length > 0 ? onboardings[0].status : null;
    return {
      id: u.id,
      firstName: u.firstName,
      lastName: u.lastName,
      email: u.email,
      isStaff: u.isStaff,
      userType: u.userType,
      status: u.status,
      freezeReason: u.freezeReason,
      tier: u.tier,
      elementsOwned: u.collectionItems.length,
      completionPercent: Math.round((u.collectionItems.length / TOTAL_ELEMENTS) * 100),
      lastActivity: u.activityLogs[0]?.createdAt?.toISOString() || null,
      joinDate: u.createdAt.toISOString(),
      onboardingStatus,
      onboardingCount: onboardings.length,
    };
  });
}

// ─── User Collection Detail ────────────────────────────────────

export async function getUserCollectionDetail(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      userType: true,
      isSubscriber: true,
      subscriptionFormat: true,
      status: true,
      freezeReason: true,
      tier: true,
      createdAt: true,
    },
  });

  if (!user) return null;

  const items = await prisma.collectionItem.findMany({
    where: { userId },
    orderBy: { atomicNumber: 'asc' },
  });

  const milestones = await prisma.milestone.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
  });

  const goals = await prisma.collectionGoalV2.findMany({
    where: { userId, isActive: true },
  });

  const recentActivity = await prisma.activityLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: 20,
  });

  // ─── Subscription onboarding records + ownership provenance (FR-26) ───
  const onboardingRecords = await prisma.subscriptionOnboarding.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch carry-forward credits for these contracts (FR-20/21)
  const carryForwardCredits = await prisma.creditTransaction.findMany({
    where: {
      userId,
      type: 'SUBSCRIPTION_CARRYFORWARD',
    },
    orderBy: { createdAt: 'desc' },
  });

  const now = Date.now();
  const subscriptionOnboardings = onboardingRecords.map(ob => {
    // Ownership records that originated from this onboarding contract (FR-3/4).
    const provenanceItems = items
      .filter(i => i.sourceSubscriptionContractId === ob.subscriptionContractId)
      .map(i => ({
        elementSymbol: i.elementSymbol,
        elementName: i.elementName,
        format: i.format,
        state: i.state,
        ownershipSource: i.ownershipSource,
        subscriberConfirmed: i.subscriberConfirmed,
        rejectedBySubscriber: i.rejectedBySubscriber,
        recordedAt: i.recordedAt ? i.recordedAt.toISOString() : null,
      }));

    // Carry-forward credits for this contract
    const contractCredits = carryForwardCredits
      .filter(c => c.subscriptionContractId === ob.subscriptionContractId)
      .map(c => ({
        id: c.id,
        amount: c.amount,
        billingCycle: c.billingCycle,
        description: c.description,
        createdAt: c.createdAt.toISOString(),
      }));

    const graceRemainingSeconds =
      ob.status === 'PENDING' && ob.graceExpiresAt
        ? Math.max(0, Math.floor((ob.graceExpiresAt.getTime() - now) / 1000))
        : null;

    return {
      id: ob.id,
      subscriptionContractId: ob.subscriptionContractId,
      formatTrack: ob.formatTrack,
      status: ob.status,
      seededFromOrderHistory: ob.seededFromOrderHistory,
      remindersSent: ob.remindersSent,
      graceExpiresAt: ob.graceExpiresAt ? ob.graceExpiresAt.toISOString() : null,
      graceRemainingSeconds,
      completedAt: ob.completedAt ? ob.completedAt.toISOString() : null,
      createdAt: ob.createdAt.toISOString(),
      provenanceItems,
      carryForwardCredits: contractCredits,
    };
  });

  // Build state map
  const stateMap = {};
  for (const item of items) {
    stateMap[item.elementSymbol] = item.state;
  }

  const ownedCount = items.filter(i => i.state === 'OWNED').length;
  const wantedCount = items.filter(i => i.state === 'WANTED').length;
  const watchlistCount = items.filter(i => i.state === 'WATCHLIST').length;

  return {
    user,
    stats: {
      owned: ownedCount,
      wanted: wantedCount,
      watchlist: watchlistCount,
      missing: TOTAL_ELEMENTS - ownedCount,
      completionPercent: Math.round((ownedCount / TOTAL_ELEMENTS) * 100),
    },
    collectionStates: stateMap,
    items,
    milestones: milestones.map(m => ({
      ...m,
      earnedAt: m.earnedAt.toISOString(),
    })),
    goals,
    recentActivity: recentActivity.map(a => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
    })),
    subscriptionOnboardings,
  };
}

// ─── Demand Insights ───────────────────────────────────────────

export async function getOutOfStockWatchlist() {
  // Group wanted/watchlist items by element
  const grouped = await prisma.collectionItem.groupBy({
    by: ['elementSymbol', 'elementName'],
    where: { state: { in: ['WANTED', 'WATCHLIST'] } },
    _count: true,
    orderBy: { _count: { elementSymbol: 'desc' } },
  });

  return grouped.map((g, idx) => ({
    sku: `${g.elementSymbol}-STD`,
    elementSymbol: g.elementSymbol,
    elementName: g.elementName,
    waitlistCount: g._count,
    daysOutOfStock: Math.floor(Math.random() * 90) + 5, // Mock for now
    inStock: Math.random() > 0.5, // Mock
  }));
}

export async function getHighDemandItems() {
  // Find elements that appear most frequently as WANTED or MISSING
  const wanted = await prisma.collectionItem.groupBy({
    by: ['elementSymbol', 'elementName'],
    where: { state: 'WANTED' },
    _count: true,
    orderBy: { _count: { elementSymbol: 'desc' } },
    take: 20,
  });

  const totalUsers = await prisma.user.count();

  // For "missing from collections" — count users who don't have the element as OWNED
  const ownedByElement = await prisma.collectionItem.groupBy({
    by: ['elementSymbol'],
    where: { state: 'OWNED' },
    _count: true,
  });
  const ownedMap = {};
  for (const o of ownedByElement) {
    ownedMap[o.elementSymbol] = o._count;
  }

  return wanted.map(w => ({
    sku: `${w.elementSymbol}-STD`,
    elementSymbol: w.elementSymbol,
    elementName: w.elementName,
    wishlistCount: w._count,
    missingFromCollections: totalUsers - (ownedMap[w.elementSymbol] || 0),
  }));
}

// ─── CSV Export Utilities ──────────────────────────────────────

export function generateCSV(data, headers) {
  if (!data || data.length === 0) return '';

  const headerRow = headers.map(h => `"${h.label}"`).join(',');
  const rows = data.map(row =>
    headers.map(h => {
      const val = typeof h.accessor === 'function'
        ? h.accessor(row)
        : row[h.key] ?? '';
      // Escape quotes and wrap in quotes
      return `"${String(val).replace(/"/g, '""')}"`;
    }).join(',')
  );

  return [headerRow, ...rows].join('\n');
}

export async function exportUsersCSV() {
  const users = await getAllUsersWithCollectionStats();
  const headers = [
    { label: 'Name', key: 'name', accessor: r => `${r.firstName} ${r.lastName}` },
    { label: 'Email', key: 'email' },
    { label: 'Elements Owned', key: 'elementsOwned' },
    { label: 'Completion %', key: 'completionPercent' },
    { label: 'User Type', key: 'userType' },
    { label: 'Last Activity', key: 'lastActivity' },
    { label: 'Join Date', key: 'joinDate' },
  ];
  return generateCSV(users, headers);
}

export async function exportDemandDataCSV() {
  const items = await getHighDemandItems();
  const headers = [
    { label: 'SKU', key: 'sku' },
    { label: 'Element', key: 'elementName' },
    { label: 'Symbol', key: 'elementSymbol' },
    { label: 'Wishlist Count', key: 'wishlistCount' },
    { label: 'Missing From Collections', key: 'missingFromCollections' },
  ];
  return generateCSV(items, headers);
}

export async function exportRestockCSV() {
  const items = await getOutOfStockWatchlist();
  const headers = [
    { label: 'SKU', key: 'sku' },
    { label: 'Element', key: 'elementName' },
    { label: 'Symbol', key: 'elementSymbol' },
    { label: 'Waitlist Count', key: 'waitlistCount' },
    { label: 'Days Out of Stock', key: 'daysOutOfStock' },
    { label: 'In Stock', key: 'inStock' },
  ];
  return generateCSV(items, headers);
}

// ─── Account Lifecycle (freeze / unfreeze / deactivate / restore / delete) ──
//
// Ported from the legacy /admin/users console so the /app/admin console
// (User.isStaff-gated) has full account-management teeth. `adminEmail` is
// recorded on the FreezeLog audit trail; the caller passes the acting staff
// member's email (from requireAdmin()).

/**
 * Freeze a single account: set status=frozen, write a FreezeLog audit row,
 * and notify the user. Temporary, reversible lock.
 */
export async function freezeUser(userId, reason, adminEmail) {
  const freezeReason = reason || "No reason provided";
  await prisma.user.update({
    where: { id: userId },
    data: { status: "frozen", freezeReason },
  });
  await prisma.freezeLog.create({
    data: { userId, reason: freezeReason, frozenBy: adminEmail },
  });
  await prisma.notification.create({
    data: {
      userId,
      category: "SYSTEM",
      title: "Account Frozen",
      body: `Your account has been frozen. Reason: ${freezeReason}. Contact support@luciteria.com to restore access.`,
      icon: "❄️",
    },
  });
}

/**
 * Unfreeze a single account: set status=active, close the open FreezeLog row,
 * and notify the user.
 */
export async function unfreezeUser(userId, adminEmail) {
  await prisma.user.update({
    where: { id: userId },
    data: { status: "active", freezeReason: null },
  });
  const latestFreeze = await prisma.freezeLog.findFirst({
    where: { userId, unfrozenAt: null },
    orderBy: { frozenAt: "desc" },
  });
  if (latestFreeze) {
    await prisma.freezeLog.update({
      where: { id: latestFreeze.id },
      data: { unfrozenAt: new Date(), unfrozenBy: adminEmail },
    });
  }
  await prisma.notification.create({
    data: {
      userId,
      category: "SYSTEM",
      title: "Account Restored",
      body: "Your account has been restored. You can now make changes to your collection.",
      icon: "✅",
    },
  });
}

/**
 * Deactivate (soft delete) one or more accounts — recoverable via restore.
 */
export async function deactivateUsers(userIds) {
  return prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { status: "deleted" },
  });
}

/**
 * Restore one or more soft-deleted / frozen accounts to active.
 */
export async function restoreUsers(userIds) {
  return prisma.user.updateMany({
    where: { id: { in: userIds } },
    data: { status: "active", freezeReason: null },
  });
}

/**
 * Permanently delete one or more users and ALL of their related data.
 * Relations WITHOUT onDelete: Cascade, plus loose userId columns, are cleared
 * manually first to avoid FK errors and orphan rows. Irreversible.
 */
export async function hardDeleteUsers(userIds) {
  return prisma.$transaction([
    prisma.userSubscription.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.creditTransaction.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.userOwnedSku.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.completionGoal.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.packOrder.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.curationRequest.deleteMany({ where: { userId: { in: userIds } } }),
    prisma.user.deleteMany({ where: { id: { in: userIds } } }),
  ]);
}

// ─── Auth Helpers ──────────────────────────────────────────────

/**
 * Require admin (staff) access. Returns user or throws redirect.
 */
export async function requireAdmin(request) {
  // The admin panel is gated on the DEDICATED staff session cookie
  // (`__luc_staff_session`), NOT the consumer cookie. This guarantees a
  // consumer storefront session can never reach /app/admin/* — staff must
  // sign in separately at /admin-login. Lazy import avoids circular deps.
  const { requireStaffUser } = await import('./staff-session.server.js');
  return requireStaffUser(request);
}
