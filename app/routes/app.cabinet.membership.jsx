/**
 * User: Membership Management
 * Display current tier, store credit, subscription controls, billing history.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useFetcher } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import { getUserId } from "../lib/session.server.js";

import { getCreditHistory } from "../lib/credits.server.js";
import { getAllFeatureFlags } from "../lib/feature-flags.server.js";
import AppNav from "../components/AppNav.jsx";
import TierBadge from "../components/TierBadge.jsx";
import CreditBalance from "../components/CreditBalance.jsx";
import SubscriptionControls from "../components/SubscriptionControls.jsx";
import CompletionProgress from "../components/CompletionProgress.jsx";
import MissingSuggestions from "../components/MissingSuggestions.jsx";

export async function loader({ request }) {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      membershipTier: true,
      userSubscriptions: { include: { tier: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });

  if (!user) return redirect("/onboarding/welcome");

  const tiers = await prisma.membershipTier.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
  });

  const creditHistory = await getCreditHistory(userId, 20);
  const subscription = user.userSubscriptions[0] || null;
  const featureFlags = await getAllFeatureFlags();

  // Phase 2 data (empty if flags disabled)
  let completionData = [];
  let suggestions = [];
  if (featureFlags.phase2_completion_display) {
    const { getAllCompletionProgress } = await import("../lib/ownership.server.js");
    completionData = await getAllCompletionProgress(userId);
  }
  if (featureFlags.phase2_suggestions) {
    const { getPrioritySuggestions } = await import("../lib/suggestions.server.js");
    suggestions = await getPrioritySuggestions(userId, user.subscriptionFormat || "lucite", 5);
  }

  return json({
    user: {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      storeCreditBalance: user.storeCreditBalance,
      subscriptionStatus: user.subscriptionStatus,
      tierName: user.membershipTier?.displayName || null,
      tierInternalName: user.membershipTier?.name || null,
    },
    subscription: subscription ? {
      id: subscription.id,
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      nextBillingDate: subscription.nextBillingDate,
      canSkipNext: subscription.canSkipNext,
      tierName: subscription.tier?.displayName,
    } : null,
    tiers,
    creditHistory,
    featureFlags,
    completionData,
    suggestions,
  });
}

export async function action({ request }) {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "subscribe") {
    const tierId = form.get("tierId");
    const tier = await prisma.membershipTier.findUnique({ where: { id: tierId } });
    if (!tier) return json({ error: "Tier not found." }, { status: 400 });

    const nextBilling = new Date();
    nextBilling.setMonth(nextBilling.getMonth() + 1);

    await prisma.$transaction([
      prisma.userSubscription.create({
        data: {
          userId, tierId,
          status: "ACTIVE",
          billingCycle: "MONTHLY",
          nextBillingDate: nextBilling,
        },
      }),
      prisma.user.update({
        where: { id: userId },
        data: { membershipTierId: tierId, subscriptionStatus: "ACTIVE" },
      }),
    ]);

    return json({ success: `Subscribed to ${tier.displayName}!` });
  }

  if (intent === "pause") {
    const sub = await prisma.userSubscription.findFirst({ where: { userId, status: "ACTIVE" } });
    if (sub) {
      await prisma.$transaction([
        prisma.userSubscription.update({ where: { id: sub.id }, data: { status: "PAUSED", pausedAt: new Date() } }),
        prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: "PAUSED" } }),
      ]);
    }
    return json({ success: "Subscription paused." });
  }

  if (intent === "resume") {
    const sub = await prisma.userSubscription.findFirst({ where: { userId, status: "PAUSED" } });
    if (sub) {
      await prisma.$transaction([
        prisma.userSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", pausedAt: null } }),
        prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: "ACTIVE" } }),
      ]);
    }
    return json({ success: "Subscription resumed!" });
  }

  if (intent === "skip") {
    const sub = await prisma.userSubscription.findFirst({ where: { userId, status: "ACTIVE" } });
    if (sub) {
      const skipped = JSON.parse(sub.skippedMonths || "[]");
      skipped.push(new Date().toISOString());
      const nextBilling = new Date(sub.nextBillingDate);
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      await prisma.userSubscription.update({
        where: { id: sub.id },
        data: { skippedMonths: JSON.stringify(skipped), nextBillingDate: nextBilling, canSkipNext: false },
      });
    }
    return json({ success: "Next month skipped." });
  }

  if (intent === "cancel") {
    const sub = await prisma.userSubscription.findFirst({ where: { userId, status: { in: ["ACTIVE", "PAUSED"] } } });
    if (sub) {
      await prisma.$transaction([
        prisma.userSubscription.update({ where: { id: sub.id }, data: { status: "CANCELLED", cancelledAt: new Date() } }),
        prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: "CANCELLED" } }),
      ]);
    }
    return json({ success: "Subscription cancelled." });
  }

  if (intent === "reactivate") {
    const sub = await prisma.userSubscription.findFirst({ where: { userId, status: "CANCELLED" } });
    if (sub) {
      const nextBilling = new Date();
      nextBilling.setMonth(nextBilling.getMonth() + 1);
      await prisma.$transaction([
        prisma.userSubscription.update({ where: { id: sub.id }, data: { status: "ACTIVE", cancelledAt: null, nextBillingDate: nextBilling, canSkipNext: true } }),
        prisma.user.update({ where: { id: userId }, data: { subscriptionStatus: "ACTIVE" } }),
      ]);
    }
    return json({ success: "Subscription reactivated!" });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function MembershipPage() {
  const { user, subscription, tiers, creditHistory, featureFlags, completionData, suggestions } = useLoaderData();
  const actionData = useActionData();
  const fetcher = useFetcher();

  const handleSubAction = (action) => {
    fetcher.submit({ intent: action }, { method: "post" });
  };

  return (
    <div style={styles.layout}>
      <AppNav mode="customer" userType={user.subscriptionStatus !== "NONE" ? "subscriber" : "collector"} />
      <main style={styles.main}>
        <h2 style={styles.title}>Membership</h2>

        {(actionData?.error || fetcher.data?.error) && <div style={styles.error}>{actionData?.error || fetcher.data?.error}</div>}
        {(actionData?.success || fetcher.data?.success) && <div style={styles.successMsg}>{actionData?.success || fetcher.data?.success}</div>}

        {/* Current Status */}
        <div style={styles.statusCard}>
          <div style={styles.statusRow}>
            <div>
              <div style={styles.statusLabel}>Current Tier</div>
              {user.tierName ? <TierBadge tierName={user.tierInternalName} size="lg" /> : <span style={styles.noTier}>No membership</span>}
            </div>
            <CreditBalance amount={user.storeCreditBalance} size="lg" />
            <div>
              <div style={styles.statusLabel}>Status</div>
              <span style={{
                ...styles.statusPill,
                backgroundColor: user.subscriptionStatus === "ACTIVE" ? "#D1FAE5" :
                  user.subscriptionStatus === "PAUSED" ? "#FEF3C7" :
                  user.subscriptionStatus === "CANCELLED" ? "#FEE2E2" : "#F3F4F6",
                color: user.subscriptionStatus === "ACTIVE" ? "#065F46" :
                  user.subscriptionStatus === "PAUSED" ? "#92400E" :
                  user.subscriptionStatus === "CANCELLED" ? "#991B1B" : "#6B7280",
              }}>
                ●{" "}{user.subscriptionStatus}
              </span>
            </div>
          </div>

          {subscription && (
            <div style={styles.billingInfo}>
              <span>Billing: {subscription.billingCycle}</span>
              <span>Next: {new Date(subscription.nextBillingDate).toLocaleDateString()}</span>
            </div>
          )}
        </div>

        {/* Subscription Controls */}
        {subscription && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Subscription Controls</h3>
            <SubscriptionControls subscription={subscription} onAction={handleSubAction} />
          </div>
        )}

        {/* Subscribe (if no subscription) */}
        {!subscription && tiers.length > 0 && (
          <div style={styles.card}>
            <h3 style={styles.cardTitle}>Choose a Membership Tier</h3>
            <div style={styles.tierGrid}>
              {tiers.map(tier => (
                <div key={tier.id} style={styles.tierOption}>
                  <div style={styles.tierIcon}>{tier.sortOrder === 1 ? "🥉" : tier.sortOrder === 2 ? "🥈" : "🥇"}</div>
                  <h4 style={{ margin: 0 }}>{tier.displayName}</h4>
                  <div style={styles.tierPrice}>${tier.monthlyPrice.toFixed(2)}/mo</div>
                  <div style={styles.tierCredit}>💰 ${tier.storeCredit.toFixed(2)} credit/mo</div>
                  {tier.earlyAccessDays > 0 && <div style={styles.tierEarly}>⚡ {tier.earlyAccessDays}d early access</div>}
                  <Form method="post">
                    <input type="hidden" name="intent" value="subscribe" />
                    <input type="hidden" name="tierId" value={tier.id} />
                    <button type="submit" style={styles.subscribeBtn}>Subscribe</button>
                  </Form>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 2: Completion Progress */}
        {featureFlags.phase2_completion_display && (
          <div style={styles.card}>
            <CompletionProgress progressData={completionData} />
          </div>
        )}

        {/* Phase 2: Suggestions */}
        {featureFlags.phase2_suggestions && suggestions.length > 0 && (
          <div style={styles.card}>
            <MissingSuggestions suggestions={suggestions} />
          </div>
        )}

        {/* Phase 3: Curation Coming Soon */}
        <div style={styles.comingSoon}>
          <h3 style={styles.comingSoonTitle}>🎁 Custom Curation (Coming Soon)</h3>
          <p style={styles.comingSoonDesc}>
            Request personalized element shipments based on your collection gaps.
          </p>
          <button style={styles.disabledBtn} disabled>Request Custom Box</button>
          <span style={styles.phaseNote}>Available in Phase 3</span>
        </div>

        {/* Credit History */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>Credit Transaction Log</h3>
          {creditHistory.length === 0 ? (
            <p style={styles.emptyLog}>No transactions yet.</p>
          ) : (
            <div style={styles.txList}>
              {creditHistory.map(tx => (
                <div key={tx.id} style={styles.txRow}>
                  <span style={{ ...styles.txType, color: tx.amount >= 0 ? "#059669" : "#DC2626" }}>
                    {tx.amount >= 0 ? "+" : ""}{tx.amount.toFixed(2)}
                  </span>
                  <span style={styles.txDesc}>{tx.description}</span>
                  <span style={styles.txDate}>{new Date(tx.createdAt).toLocaleDateString()}</span>
                  <span style={styles.txBalance}>${tx.balanceAfter.toFixed(2)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "800px" },
  title: { margin: "0 0 24px", fontSize: "24px", fontWeight: 700 },
  error: { padding: "12px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px" },
  successMsg: { padding: "12px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px" },
  statusCard: { padding: "24px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "20px" },
  statusRow: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "24px", flexWrap: "wrap" },
  statusLabel: { fontSize: "11px", color: "#6B7280", textTransform: "uppercase", marginBottom: "4px" },
  noTier: { fontSize: "16px", color: "#9CA3AF" },
  statusPill: { display: "inline-block", padding: "4px 12px", borderRadius: "12px", fontSize: "13px", fontWeight: 600 },
  billingInfo: { display: "flex", gap: "24px", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid #F3F4F6", fontSize: "13px", color: "#6B7280" },
  card: { padding: "20px", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB", marginBottom: "20px" },
  cardTitle: { margin: "0 0 16px", fontSize: "16px", fontWeight: 700 },
  tierGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" },
  tierOption: { padding: "20px", textAlign: "center", backgroundColor: "#F9FAFB", borderRadius: "10px", border: "1px solid #E5E7EB" },
  tierIcon: { fontSize: "32px", marginBottom: "8px" },
  tierPrice: { fontSize: "20px", fontWeight: 700, margin: "8px 0 4px" },
  tierCredit: { fontSize: "13px", color: "#059669", marginBottom: "4px" },
  tierEarly: { fontSize: "12px", color: "#6366F1", marginBottom: "12px" },
  subscribeBtn: { padding: "8px 24px", backgroundColor: "#2563EB", color: "#fff", border: "none", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer" },
  comingSoon: {
    padding: "24px", backgroundColor: "#F9FAFB", borderRadius: "12px",
    border: "1px dashed #D1D5DB", textAlign: "center", marginBottom: "20px",
  },
  comingSoonTitle: { margin: "0 0 8px", fontSize: "18px", fontWeight: 700, color: "#374151" },
  comingSoonDesc: { margin: "0 0 16px", fontSize: "14px", color: "#6B7280" },
  disabledBtn: { padding: "10px 24px", backgroundColor: "#E5E7EB", color: "#9CA3AF", border: "none", borderRadius: "8px", fontSize: "14px", fontWeight: 600, cursor: "not-allowed" },
  phaseNote: { display: "block", marginTop: "8px", fontSize: "12px", color: "#9CA3AF" },
  emptyLog: { fontSize: "14px", color: "#9CA3AF", textAlign: "center", padding: "16px" },
  txList: { display: "flex", flexDirection: "column", gap: "4px" },
  txRow: { display: "flex", alignItems: "center", gap: "12px", padding: "8px 0", borderBottom: "1px solid #F3F4F6", fontSize: "13px" },
  txType: { width: "70px", fontWeight: 700, fontFamily: "monospace" },
  txDesc: { flex: 1, color: "#374151" },
  txDate: { width: "80px", color: "#9CA3AF", fontSize: "12px" },
  txBalance: { width: "70px", color: "#6B7280", fontFamily: "monospace", textAlign: "right" },
};
