/**
 * User: Collector Pack Storefront
 * Display available packs filtered by user tier, purchase with credits or direct buy.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import { getUserId } from "../lib/session.server.js";
import { spendCredit } from "../lib/credits.server.js";
import AppNav from "../components/AppNav.jsx";
import PackCard from "../components/PackCard.jsx";
import CreditBalance from "../components/CreditBalance.jsx";

export async function loader({ request }) {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { membershipTier: true },
  });
  if (!user) return redirect("/onboarding/welcome");

  const packs = await prisma.collectorPack.findMany({
    where: { isActive: true },
    include: { tier: true },
    orderBy: { createdAt: "desc" },
  });

  // Enrich packs with tier name for display
  const enrichedPacks = packs.map(p => ({
    ...p,
    tierName: p.tier?.name || null,
    tierDisplayName: p.tier?.displayName || null,
  }));

  return json({
    packs: enrichedPacks,
    user: {
      id: user.id,
      firstName: user.firstName,
      storeCreditBalance: user.storeCreditBalance,
      tierName: user.membershipTier?.name || null,
      subscriptionStatus: user.subscriptionStatus,
    },
  });
}

export async function action({ request }) {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const form = await request.formData();
  const intent = form.get("intent");
  const packId = form.get("packId");

  const pack = await prisma.collectorPack.findUnique({ where: { id: packId }, include: { tier: true } });
  if (!pack || !pack.isActive) {
    return json({ error: "Pack not available." }, { status: 400 });
  }

  // Check tier restriction
  if (pack.tier) {
    const user = await prisma.user.findUnique({ where: { id: userId }, include: { membershipTier: true } });
    if (!user.membershipTier || user.membershipTier.sortOrder < pack.tier.sortOrder) {
      return json({ error: `This pack requires ${pack.tier.displayName} tier or higher.` }, { status: 403 });
    }
  }

  if (intent === "buy_credits") {
    if (!pack.creditCost || pack.creditCost <= 0) {
      return json({ error: "This pack cannot be purchased with credits." }, { status: 400 });
    }

    try {
      await spendCredit(userId, pack.creditCost, `Pack purchase: ${pack.name}`);
    } catch (err) {
      return json({ error: err.message }, { status: 400 });
    }

    // Create pack order (always requires admin approval)
    await prisma.packOrder.create({
      data: {
        userId,
        packId: pack.id,
        packName: pack.name,
        status: "PENDING",
        paymentMethod: "CREDIT",
        creditAmount: pack.creditCost,
        skuList: pack.skuList,
      },
    });

    return json({ success: `${pack.name} ordered with credits! Awaiting admin approval.` });
  }

  if (intent === "buy_direct") {
    if (!pack.price) {
      return json({ error: "This pack has no direct purchase price." }, { status: 400 });
    }

    // Create pack order (simulated — in production would connect to Shopify checkout)
    await prisma.packOrder.create({
      data: {
        userId,
        packId: pack.id,
        packName: pack.name,
        status: "PENDING",
        paymentMethod: "DIRECT",
        cashAmount: pack.price,
        skuList: pack.skuList,
      },
    });

    return json({ success: `${pack.name} ordered! Awaiting admin approval.` });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function PackStorefront() {
  const { packs, user } = useLoaderData();
  const actionData = useActionData();

  const handlePurchase = (packId) => {
    const form = document.createElement("form");
    form.method = "post";
    form.style.display = "none";
    const i1 = document.createElement("input"); i1.name = "intent"; i1.value = "buy_direct";
    const i2 = document.createElement("input"); i2.name = "packId"; i2.value = packId;
    form.append(i1, i2);
    document.body.appendChild(form);
    form.submit();
  };

  const handlePurchaseWithCredits = (packId) => {
    const form = document.createElement("form");
    form.method = "post";
    form.style.display = "none";
    const i1 = document.createElement("input"); i1.name = "intent"; i1.value = "buy_credits";
    const i2 = document.createElement("input"); i2.name = "packId"; i2.value = packId;
    form.append(i1, i2);
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div style={styles.layout}>
      <AppNav mode="customer" userType={user.subscriptionStatus !== "NONE" ? "subscriber" : "collector"} />
      <main style={styles.main}>
        <div style={styles.header}>
          <div>
            <h2 style={styles.title}>Collector Packs</h2>
            <p style={styles.subtitle}>Curated element collections — hand-picked by Luciteria</p>
          </div>
          <CreditBalance amount={user.storeCreditBalance} size="md" />
        </div>

        {actionData?.error && <div style={styles.error}>{actionData.error}</div>}
        {actionData?.success && <div style={styles.successMsg}>{actionData.success}</div>}

        {packs.length === 0 ? (
          <div style={styles.emptyState}>
            <span style={{ fontSize: "48px" }}>📦</span>
            <h3>No packs available yet</h3>
            <p>Check back soon — new collector packs are on the way!</p>
          </div>
        ) : (
          <div style={styles.packGrid}>
            {packs.map(pack => (
              <PackCard
                key={pack.id}
                pack={pack}
                userTier={user.tierName}
                onPurchase={handlePurchase}
                onPurchaseWithCredits={handlePurchaseWithCredits}
              />
            ))}
          </div>
        )}

        <div style={styles.info}>
          <h4 style={{ margin: "0 0 8px" }}>📋 How It Works</h4>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#374151", lineHeight: 1.8 }}>
            <li>Browse themed packs curated by the Luciteria team</li>
            <li>Purchase with store credits or direct payment</li>
            <li>All orders are reviewed by our team before shipping</li>
            <li>Some packs are exclusive to specific membership tiers</li>
          </ul>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "960px" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700 },
  subtitle: { margin: "4px 0 0", fontSize: "14px", color: "#6B7280" },
  error: { padding: "12px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px" },
  successMsg: { padding: "12px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px" },
  packGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "20px", marginBottom: "32px" },
  emptyState: { textAlign: "center", padding: "48px", color: "#6B7280", backgroundColor: "#fff", borderRadius: "12px", border: "1px solid #E5E7EB" },
  info: { padding: "20px", backgroundColor: "#F0F9FF", borderRadius: "12px", border: "1px solid #BAE6FD" },
};
