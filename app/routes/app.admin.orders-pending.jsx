/**
 * Admin: Order Approval Dashboard
 * View subscription-related orders pending fulfillment.
 * Admin must click "Approve" — NO auto-shipping.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import AppNav from "../components/AppNav.jsx";
import ApprovalQueue from "../components/ApprovalQueue.jsx";

export async function loader() {
  const pendingOrders = await prisma.packOrder.findMany({
    where: { status: "PENDING" },
    orderBy: { createdAt: "asc" },
  });

  const recentOrders = await prisma.packOrder.findMany({
    where: { status: { not: "PENDING" } },
    orderBy: { updatedAt: "desc" },
    take: 20,
  });

  // Enrich with user info
  const userIds = [...new Set([...pendingOrders, ...recentOrders].map(o => o.userId))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, firstName: true, lastName: true, email: true, membershipTier: { select: { name: true } } },
  });
  const userMap = {};
  for (const u of users) userMap[u.id] = u;

  const enrichOrder = (o) => {
    const user = userMap[o.userId];
    return {
      ...o,
      userName: user ? `${user.firstName} ${user.lastName}` : "Unknown",
      userEmail: user?.email,
      tierName: user?.membershipTier?.name,
    };
  };

  return json({
    pendingOrders: pendingOrders.map(enrichOrder),
    recentOrders: recentOrders.map(enrichOrder),
    stats: {
      pending: pendingOrders.length,
      totalCredit: pendingOrders.reduce((sum, o) => sum + o.creditAmount, 0),
      totalCash: pendingOrders.reduce((sum, o) => sum + o.cashAmount, 0),
    },
  });
}

export async function action({ request }) {
  const form = await request.formData();
  const intent = form.get("intent");
  const orderId = form.get("orderId");

  if (intent === "approve") {
    if (orderId === "all") {
      const pending = await prisma.packOrder.findMany({ where: { status: "PENDING" } });
      for (const order of pending) {
        await prisma.packOrder.update({
          where: { id: order.id },
          data: { status: "ADMIN_APPROVED", approvedBy: "admin", approvedAt: new Date() },
        });
      }
      return json({ success: `${pending.length} orders approved.` });
    }

    const order = await prisma.packOrder.findUnique({ where: { id: orderId } });
    if (!order || order.status !== "PENDING") {
      return json({ error: "Order not found or already processed." }, { status: 400 });
    }

    await prisma.packOrder.update({
      where: { id: orderId },
      data: { status: "ADMIN_APPROVED", approvedBy: "admin", approvedAt: new Date() },
    });
    return json({ success: "Order approved for fulfillment." });
  }

  if (intent === "reject") {
    const notes = form.get("notes") || "Rejected by admin.";
    await prisma.packOrder.update({
      where: { id: orderId },
      data: { status: "REJECTED", adminNotes: notes, rejectedAt: new Date() },
    });
    return json({ success: "Order rejected." });
  }

  if (intent === "fulfill") {
    await prisma.packOrder.update({
      where: { id: orderId },
      data: { status: "FULFILLED", fulfilledAt: new Date() },
    });
    return json({ success: "Order marked as fulfilled." });
  }

  return json({ error: "Unknown action" }, { status: 400 });
}

export default function AdminOrdersPending() {
  const { pendingOrders, recentOrders, stats } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const handleApprove = (orderId) => {
    const formData = new FormData();
    formData.set("intent", "approve");
    formData.set("orderId", orderId);
    // Use form submission
    const form = document.createElement("form");
    form.method = "post";
    form.style.display = "none";
    const i1 = document.createElement("input"); i1.name = "intent"; i1.value = "approve";
    const i2 = document.createElement("input"); i2.name = "orderId"; i2.value = orderId;
    form.append(i1, i2);
    document.body.appendChild(form);
    form.submit();
  };

  const handleReject = (orderId) => {
    const form = document.createElement("form");
    form.method = "post";
    form.style.display = "none";
    const i1 = document.createElement("input"); i1.name = "intent"; i1.value = "reject";
    const i2 = document.createElement("input"); i2.name = "orderId"; i2.value = orderId;
    form.append(i1, i2);
    document.body.appendChild(form);
    form.submit();
  };

  return (
    <div style={styles.layout}>
      <AppNav mode="admin" />
      <main style={styles.main}>
        <h2 style={styles.title}>Order Approval Queue</h2>
        <p style={styles.subtitle}>⚠️ Orders are NEVER auto-shipped — admin approval required for every fulfillment</p>

        {actionData?.error && <div style={styles.error}>{actionData.error}</div>}
        {actionData?.success && <div style={styles.successMsg}>{actionData.success}</div>}

        <div style={styles.statsRow}>
          <div style={styles.statCard}>
            <span style={styles.statIcon}>📋</span>
            <span style={styles.statValue}>{stats.pending}</span>
            <span style={styles.statLabel}>Pending</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statIcon}>💰</span>
            <span style={styles.statValue}>${stats.totalCredit.toFixed(2)}</span>
            <span style={styles.statLabel}>Credit Used</span>
          </div>
          <div style={styles.statCard}>
            <span style={styles.statIcon}>💵</span>
            <span style={styles.statValue}>${stats.totalCash.toFixed(2)}</span>
            <span style={styles.statLabel}>Cash Revenue</span>
          </div>
        </div>

        <ApprovalQueue
          orders={pendingOrders}
          onApprove={handleApprove}
          onReject={handleReject}
        />

        {recentOrders.length > 0 && (
          <div style={{ marginTop: "32px" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Recent Orders</h3>
            <div style={styles.recentList}>
              {recentOrders.map(order => (
                <div key={order.id} style={styles.recentItem}>
                  <span style={styles.recentId}>#{order.id.slice(0, 8)}</span>
                  <span>{order.userName}</span>
                  <span style={styles.recentPack}>{order.packName}</span>
                  <span style={{
                    ...styles.statusPill,
                    backgroundColor: order.status === "ADMIN_APPROVED" ? "#D1FAE5" :
                      order.status === "FULFILLED" ? "#DBEAFE" :
                      order.status === "REJECTED" ? "#FEE2E2" : "#F3F4F6",
                    color: order.status === "ADMIN_APPROVED" ? "#065F46" :
                      order.status === "FULFILLED" ? "#1E40AF" :
                      order.status === "REJECTED" ? "#991B1B" : "#6B7280",
                  }}>
                    {order.status}
                  </span>
                  {order.status === "ADMIN_APPROVED" && (
                    <Form method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="intent" value="fulfill" />
                      <input type="hidden" name="orderId" value={order.id} />
                      <button type="submit" style={styles.fulfillBtn}>📦 Mark Fulfilled</button>
                    </Form>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "960px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700 },
  subtitle: { margin: "4px 0 24px", fontSize: "14px", color: "#DC2626", fontWeight: 500 },
  error: { padding: "12px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px" },
  successMsg: { padding: "12px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px" },
  statsRow: { display: "flex", gap: "16px", marginBottom: "24px" },
  statCard: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", padding: "16px", backgroundColor: "#fff", borderRadius: "10px", border: "1px solid #E5E7EB" },
  statIcon: { fontSize: "24px" },
  statValue: { fontSize: "24px", fontWeight: 700, color: "#111827" },
  statLabel: { fontSize: "12px", color: "#6B7280" },
  recentList: { display: "flex", flexDirection: "column", gap: "8px" },
  recentItem: { display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px", backgroundColor: "#fff", borderRadius: "8px", border: "1px solid #E5E7EB", fontSize: "13px" },
  recentId: { fontFamily: "monospace", color: "#6366F1", fontSize: "12px" },
  recentPack: { flex: 1, fontWeight: 600 },
  statusPill: { fontSize: "11px", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 },
  fulfillBtn: { padding: "4px 10px", backgroundColor: "#DBEAFE", color: "#1E40AF", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: 600, cursor: "pointer" },
};
