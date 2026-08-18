/**
 * Subscription Management Page (Phase 2)
 * 
 * Active plan details, billing with dual model, grandfathering info.
 * Collection type aware. Light theme.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import AppNav from "../components/AppNav";
import { getBillingSummary, generateBillingSchedule } from "../lib/billing.server.js";
import { getUserId } from "../lib/session.server.js";
import { getUserById } from "../lib/auth.server.js";
import { prisma } from "../lib/db.server.js";

export const loader = async ({ request }) => {
  const userId = await getUserId(request);
  if (!userId) return redirect("/onboarding/welcome");

  const authUser = await getUserById(userId);
  if (!authUser) return redirect("/onboarding/welcome");

  // Find the Customer record via shopifyCustomerId
  const customer = authUser.shopifyCustomerId
    ? await prisma.customer.findUnique({
        where: { shopifyCustomerId: authUser.shopifyCustomerId },
      })
    : null;

  if (!customer) {
    // No customer record = no subscription possible
    return json({
      customer: {
        firstName: authUser.firstName,
        lastName: authUser.lastName,
        displayName: authUser.firstName || "Collector",
      },
      subscription: null,
      shipments: [],
      stats: { totalShipments: 0, totalSpent: 0, currentMonthSpent: 0 },
      customerId: null,
      collectionType: "lucite",
      billingSummary: null,
      billingSchedule: [],
    });
  }

  // Find the Subscription by customerId
  const subscription = await prisma.subscription.findUnique({
    where: { customerId: customer.id },
  });

  // Map Subscription to the shape expected by the UI
  const mappedSubscription = subscription
    ? {
        id: subscription.id,
        planName: subscription.planName,
        planTier: subscription.planTier,
        status: subscription.status,
        billingCadence: subscription.billingCadence,
        priceUsd: subscription.priceUsd,
        nextShipmentDate: subscription.nextShipmentDate,
        nextBillingDate: subscription.nextBillingDate,
        startDate: subscription.startDate,
        itemsPerShipment: subscription.itemsPerShipment,
        collectionType: subscription.collectionType,
        priceLockedAt: subscription.priceLockedAt,
        priceExpiresAt: subscription.priceExpiresAt,
        originalPrice: subscription.originalPrice,
        currentPrice: subscription.currentPrice,
        grandfathered: subscription.grandfathered,
        pausedAt: subscription.pausedAt,
        cancelledAt: subscription.cancelledAt,
      }
    : null;

  // Get shipments (simplified — map to the structure expected by UI)
  const shipments = subscription
    ? await prisma.subscriptionShipment.findMany({
        where: { subscriptionId: subscription.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      })
    : [];

  // Compute billing summary and schedule
  let billingSummary = null;
  let billingSchedule = [];
  if (mappedSubscription) {
    billingSummary = getBillingSummary(mappedSubscription);
    billingSchedule = generateBillingSchedule(
      mappedSubscription.startDate,
      mappedSubscription.priceUsd,
      4
    );
  }

  // Compute basic stats from shipments
  const stats = {
    totalShipments: shipments.length,
    totalSpent: shipments.reduce((sum, s) => sum + (s.assignedPrice || 0), 0),
    currentMonthSpent: 0, // Simplified for now
  };

  return json({
    customer: {
      firstName: customer.firstName,
      lastName: customer.lastName,
      displayName: customer.displayName,
    },
    subscription: mappedSubscription,
    shipments: shipments.map((s) => ({
      id: s.id,
      date: s.createdAt,
      status: s.status,
      tracking: s.trackingNumber,
      items: [], // Simplified — real impl would join products
      retailPrice: s.retailPrice || 0,
      assignedPrice: s.assignedPrice || 0,
      discountPercent: 0,
    })),
    stats,
    customerId: customer.id,
    collectionType: subscription?.collectionType || customer.collectionType || "lucite",
    billingSummary,
    billingSchedule,
  });
};

export default function SubscriptionPage() {
  const { customer, subscription, shipments, stats, collectionType, billingSummary, billingSchedule } = useLoaderData();

  if (!subscription) {
    return (
      <div style={styles.layout}>
        <AppNav mode="customer" customerName={customer?.firstName} collectionType={collectionType} />
        <main style={styles.main} className="luc-main">
          <div style={styles.emptyState}>
            <span style={styles.emptyIcon}>📬</span>
            <h2 style={styles.emptyTitle}>No Active Subscription</h2>
            <p style={styles.emptyText}>
              A subscription means a new element lands on your doorstep each month.
              No duplicates. No guessing. Just pure, curated discovery.
            </p>
            <div style={styles.plans}>
              <PlanCard
                name="Element Explorer"
                price="$79.99"
                cadence="monthly"
                items="1 element per shipment"
                features={["Duplicate prevention", "Category preferences", "Skip anytime"]}
                accent="var(--luc-accent)"
              />
              <PlanCard
                name="Completionist"
                price="$149.99"
                cadence="monthly"
                items="1 premium element per shipment"
                features={["Wishlist priority", "Rare element access", "No budget cap", "Priority support"]}
                accent="var(--luc-gold)"
                featured
              />
            </div>
          </div>
        </main>
      </div>
    );
  }

  const statusColor = subscription.status === "active" ? "var(--luc-success)" :
    subscription.status === "paused" ? "var(--luc-warning)" : "var(--luc-danger)";

  return (
    <div style={styles.layout}>
      <AppNav mode="customer" customerName={customer?.firstName} collectionType={collectionType} />
      <main style={styles.main} className="luc-main">
        <h2 style={styles.title}>Your Subscription</h2>
        <p style={styles.subtitle}>Your element pipeline, fully transparent.</p>

        {/* Plan Overview Card */}
        <div style={styles.planCard}>
          <div style={styles.planHeader}>
            <div>
              <div style={styles.planName}>{subscription.planName}</div>
              <div style={styles.planTier}>{subscription.planTier} tier</div>
            </div>
            <div style={{ ...styles.statusPill, background: statusColor + "15", color: statusColor }}>
              {subscription.status}
            </div>
          </div>

          <div style={styles.planDetails}>
            <div style={styles.planDetail}>
              <span style={styles.detailLabel}>Price</span>
              <span style={styles.detailValue}>${subscription.priceUsd}/mo</span>
            </div>
            <div style={styles.planDetail}>
              <span style={styles.detailLabel}>Collection</span>
              <span style={styles.detailValue}>{collectionType}</span>
            </div>
            <div style={styles.planDetail}>
              <span style={styles.detailLabel}>Cadence</span>
              <span style={styles.detailValue}>{subscription.billingCadence}</span>
            </div>
            <div style={styles.planDetail}>
              <span style={styles.detailLabel}>Items/Shipment</span>
              <span style={styles.detailValue}>{subscription.itemsPerShipment}</span>
            </div>
            <div style={styles.planDetail}>
              <span style={styles.detailLabel}>Next Shipment</span>
              <span style={styles.detailValue}>{formatDate(subscription.nextShipmentDate)}</span>
            </div>
            <div style={styles.planDetail}>
              <span style={styles.detailLabel}>Next Billing</span>
              <span style={styles.detailValue}>{billingSummary ? billingSummary.nextBillingDate : formatDate(subscription.nextBillingDate)}</span>
            </div>
          </div>

          {/* Grandfathering info */}
          {billingSummary?.grandfather?.isGrandfathered && (
            <div style={styles.grandfatherBox}>
              <span style={styles.grandfatherIcon}>🔒</span>
              <div>
                <div style={styles.grandfatherTitle}>Grandfathered Price Active</div>
                <div style={styles.grandfatherText}>
                  Your ${billingSummary.grandfather.originalPrice}/mo rate is locked until {billingSummary.grandfather.expiresAt}.
                  {billingSummary.grandfather.monthlySavings > 0 && (
                    <> You save <strong>${billingSummary.grandfather.monthlySavings.toFixed(2)}/mo</strong> vs current price.</>
                  )}
                  {billingSummary.grandfather.daysRemaining > 0 && (
                    <> ({billingSummary.grandfather.daysRemaining} days remaining)</>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5-day edge case note */}
          {billingSummary?.isEdgeCaseSignup && (
            <div style={styles.edgeCaseNote}>
              ℹ️ {billingSummary.edgeCaseNote}
            </div>
          )}

          {/* Manage via Seal Portal */}
          <div style={styles.manageBox}>
            <div style={styles.manageIcon}>⚙️</div>
            <div style={styles.manageContent}>
              <div style={styles.manageTitle}>Manage Your Subscription</div>
              <div style={styles.manageText}>
                Pause, skip, or cancel your subscription anytime through our secure customer portal.
              </div>
              <div style={styles.manageLinks}>
                <a
                  href="/a/subscriptions/manage"
                  style={styles.portalLinkPrimary}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Manage Subscription →
                </a>
                <a
                  href="/a/subscriptions/login"
                  style={styles.portalLinkSecondary}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Request login link
                </a>
              </div>
            </div>
          </div>
        </div>

        {/* Billing Schedule */}
        {billingSchedule.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Upcoming Billing</h3>
            <div style={styles.scheduleList}>
              {billingSchedule.map((b, i) => (
                <div key={i} style={styles.scheduleRow}>
                  <span style={styles.scheduleDate}>{formatDate(b.date)}</span>
                  <span style={styles.scheduleAmount}>${b.amount.toFixed(2)}</span>
                  <span style={styles.scheduleLabel}>{b.label}</span>
                </div>
              ))}
            </div>
            <div style={styles.billingNote}>
              Billing day: <strong>1st of each month</strong> (first charge at signup)
            </div>
          </div>
        )}

        {/* How it works */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>How Your Subscription Works</h3>
          <div style={styles.howItWorks}>
            <div style={styles.step}>
              <span style={styles.stepNum}>1</span>
              <div>
                <strong>We check your cabinet</strong>
                <p>Our engine knows every element you own. No duplicates, guaranteed.</p>
              </div>
            </div>
            <div style={styles.step}>
              <span style={styles.stepNum}>2</span>
              <div>
                <strong>Collection type filter</strong>
                <p>Only {collectionType} products matching your collection are considered.</p>
              </div>
            </div>
            <div style={styles.step}>
              <span style={styles.stepNum}>3</span>
              <div>
                <strong>Wishlist gets priority</strong>
                <p>If an item on your wishlist is in stock, it jumps to the front of the line.</p>
              </div>
            </div>
            <div style={styles.step}>
              <span style={styles.stepNum}>4</span>
              <div>
                <strong>Shipped to your door</strong>
                <p>Carefully packaged. Tracking included. One more element for the cabinet.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Shipment History */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Shipment History</h3>
          {shipments.length === 0 ? (
            <div style={styles.noShipments}>
              <p>Your first shipment is coming soon. The anticipation is part of the fun.</p>
            </div>
          ) : (
            <div style={styles.shipmentList}>
              {shipments.map((s) => (
                <div key={s.id} style={styles.shipmentCard}>
                  <div style={styles.shipmentLeft}>
                    <div style={{
                      ...styles.shipmentStatusDot,
                      background: s.status === "delivered" ? "var(--luc-success)" :
                        s.status === "shipped" ? "var(--luc-accent)" :
                        s.status === "skipped" ? "var(--luc-text-muted)" : "var(--luc-warning)",
                    }} />
                    <div>
                      <div style={styles.shipmentDate}>{formatDate(s.date)}</div>
                      <div style={styles.shipmentStatusText}>
                        {s.status === "delivered" ? "Delivered" :
                         s.status === "shipped" ? "In Transit" :
                         s.status === "skipped" ? "Skipped" : s.status}
                      </div>
                    </div>
                  </div>
                  <div style={styles.shipmentItems}>
                    {s.itemProducts.map((p) => (
                      <div key={p.id} style={styles.shipmentItem}>
                        <span style={styles.shipmentSymbol}>{p.elementSymbol}</span>
                        <span>{p.title}</span>
                        {s.discountPercent != null && s.discountPercent > 0 && (
                          <span style={{
                            fontSize: 11,
                            marginLeft: 8,
                            color: s.discountPercent > 20 ? "var(--luc-danger)" : "var(--luc-success)",
                            fontWeight: 600,
                          }}>
                            {s.discountPercent.toFixed(0)}% off
                          </span>
                        )}
                      </div>
                    ))}
                    {s.itemProducts.length === 0 && (
                      <span style={{ color: "var(--luc-text-muted)", fontStyle: "italic" }}>No items</span>
                    )}
                  </div>
                  {s.tracking && (
                    <div style={styles.tracking}>{s.tracking}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function PlanCard({ name, price, cadence, items, features, accent, featured }) {
  return (
    <div style={{
      ...styles.planPreview,
      borderColor: featured ? accent : "var(--luc-border)",
      borderWidth: featured ? 2 : 1,
    }}>
      {featured && <div style={{ ...styles.featuredBadge, background: accent }}>Most Popular</div>}
      <h3 style={{ ...styles.planPreviewName, color: accent }}>{name}</h3>
      <div style={styles.planPreviewPrice}>{price}<span style={styles.planPreviewCadence}>/{cadence}</span></div>
      <div style={styles.planPreviewItems}>{items}</div>
      <ul style={styles.planPreviewFeatures}>
        {features.map((f, i) => <li key={i}>✓ {f}</li>)}
      </ul>
      <button style={{ ...styles.planPreviewBtn, background: accent }}>Choose Plan</button>
    </div>
  );
}

function formatDate(str) {
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: { marginLeft: 240, flex: 1, padding: "24px 40px 60px", maxWidth: 800 },
  title: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 14, color: "var(--luc-text-muted)", margin: "4px 0 24px" },
  planCard: {
    background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 16, padding: 24, marginBottom: 32,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  planHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 },
  planName: { fontSize: 22, fontWeight: 700, color: "var(--luc-text)" },
  planTier: { fontSize: 13, color: "var(--luc-text-muted)", textTransform: "uppercase" },
  statusPill: {
    padding: "4px 12px", borderRadius: 20, fontSize: 12, fontWeight: 700, textTransform: "uppercase",
  },
  planDetails: {
    display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16, marginBottom: 20,
  },
  planDetail: { display: "flex", flexDirection: "column", gap: 2 },
  detailLabel: { fontSize: 11, color: "var(--luc-text-muted)", textTransform: "uppercase", fontWeight: 600 },
  detailValue: { fontSize: 15, fontWeight: 600, color: "var(--luc-text)" },
  grandfatherBox: {
    display: "flex", gap: 12, alignItems: "flex-start",
    padding: 14, background: "#f0fdf4", border: "1px solid #bbf7d0",
    borderRadius: 10, marginBottom: 16,
  },
  grandfatherIcon: { fontSize: 20, flexShrink: 0 },
  grandfatherTitle: { fontSize: 13, fontWeight: 700, color: "#166534" },
  grandfatherText: { fontSize: 12, color: "#15803d", lineHeight: 1.5 },
  edgeCaseNote: {
    fontSize: 12, color: "var(--luc-text-muted)", background: "#eff6ff",
    padding: "8px 12px", borderRadius: 8, marginBottom: 16,
  },
  manageBox: {
    display: "flex", gap: 14, alignItems: "flex-start",
    padding: 16, background: "#f9fafb", border: "1px solid var(--luc-border)",
    borderRadius: 10, marginTop: 16,
  },
  manageIcon: { fontSize: 24, flexShrink: 0 },
  manageContent: { flex: 1 },
  manageTitle: { fontSize: 14, fontWeight: 700, color: "var(--luc-text)", marginBottom: 4 },
  manageText: { fontSize: 13, color: "var(--luc-text-muted)", marginBottom: 12, lineHeight: 1.4 },
  manageLinks: { display: "flex", gap: 10, flexWrap: "wrap" },
  portalLinkPrimary: {
    display: "inline-block", padding: "8px 16px", borderRadius: 8,
    background: "var(--luc-accent, #2563eb)", color: "#fff",
    fontSize: 13, fontWeight: 600, textDecoration: "none",
    transition: "all 0.15s",
  },
  portalLinkSecondary: {
    display: "inline-block", padding: "8px 16px", borderRadius: 8,
    background: "transparent", border: "1px solid var(--luc-border)",
    color: "var(--luc-text)", fontSize: 13, fontWeight: 600,
    textDecoration: "none", transition: "all 0.15s",
  },
  section: { marginBottom: 32 },
  sectionTitle: {
    fontSize: 16, fontWeight: 700, color: "var(--luc-text)", marginBottom: 16,
    paddingBottom: 8, borderBottom: "1px solid var(--luc-border)",
  },
  scheduleList: { display: "flex", flexDirection: "column", gap: 6 },
  scheduleRow: {
    display: "flex", alignItems: "center", gap: 16, padding: "10px 14px",
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 8,
    fontSize: 13,
  },
  scheduleDate: { fontWeight: 600, color: "var(--luc-text)", minWidth: 120 },
  scheduleAmount: { fontWeight: 700, color: "var(--luc-accent)", minWidth: 80 },
  scheduleLabel: { color: "var(--luc-text-muted)" },
  billingNote: { fontSize: 12, color: "var(--luc-text-muted)", marginTop: 8 },
  howItWorks: { display: "flex", flexDirection: "column", gap: 16 },
  step: {
    display: "flex", gap: 14, alignItems: "flex-start",
    background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 10, padding: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  stepNum: {
    width: 32, height: 32, background: "var(--luc-accent)", color: "#fff",
    borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 14, fontWeight: 700, flexShrink: 0,
  },
  shipmentList: { display: "flex", flexDirection: "column", gap: 10 },
  shipmentCard: {
    display: "flex", alignItems: "center", gap: 16,
    background: "#ffffff", border: "1px solid var(--luc-border)",
    borderRadius: 10, padding: "14px 16px",
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  shipmentLeft: { display: "flex", alignItems: "center", gap: 10, minWidth: 140 },
  shipmentStatusDot: { width: 10, height: 10, borderRadius: "50%", flexShrink: 0 },
  shipmentDate: { fontSize: 13, fontWeight: 600, color: "var(--luc-text)" },
  shipmentStatusText: { fontSize: 11, color: "var(--luc-text-muted)" },
  shipmentItems: { flex: 1, display: "flex", flexDirection: "column", gap: 4 },
  shipmentItem: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--luc-text)" },
  shipmentSymbol: { fontWeight: 800, color: "var(--luc-accent)", minWidth: 28 },
  tracking: { fontSize: 11, color: "var(--luc-text-muted)", fontFamily: "monospace" },
  noShipments: { padding: 24, textAlign: "center", color: "var(--luc-text-muted)", fontStyle: "italic" },
  // Empty state & plan cards
  emptyState: { textAlign: "center", paddingTop: 40 },
  emptyIcon: { fontSize: 56, display: "block", marginBottom: 16 },
  emptyTitle: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  emptyText: { fontSize: 14, color: "var(--luc-text-muted)", maxWidth: 480, margin: "8px auto 32px" },
  plans: { display: "flex", gap: 20, justifyContent: "center", flexWrap: "wrap" },
  planPreview: {
    background: "#ffffff", border: "1px solid", borderRadius: 16,
    padding: 24, width: 260, textAlign: "left", position: "relative",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  featuredBadge: {
    position: "absolute", top: -10, right: 16, padding: "3px 10px",
    borderRadius: 10, fontSize: 11, fontWeight: 700, color: "#fff",
  },
  planPreviewName: { fontSize: 18, fontWeight: 700, margin: "0 0 8px" },
  planPreviewPrice: { fontSize: 28, fontWeight: 800, color: "var(--luc-text)" },
  planPreviewCadence: { fontSize: 14, fontWeight: 400, color: "var(--luc-text-muted)" },
  planPreviewItems: { fontSize: 13, color: "var(--luc-text-muted)", margin: "8px 0 12px" },
  planPreviewFeatures: {
    listStyle: "none", padding: 0, margin: "0 0 16px", display: "flex",
    flexDirection: "column", gap: 6, fontSize: 13, color: "var(--luc-text-muted)",
  },
  planPreviewBtn: {
    width: "100%", padding: "10px", borderRadius: 8, border: "none",
    color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
  },
};
