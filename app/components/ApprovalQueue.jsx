/**
 * ApprovalQueue — Admin order review list
 * Shows pending pack orders awaiting admin approval.
 */
import React from "react";
import TierBadge from "./TierBadge.jsx";

export default function ApprovalQueue({ orders = [], onApprove, onReject }) {
  if (orders.length === 0) {
    return (
      <div style={styles.empty}>
        <span style={{ fontSize: "32px" }}>✅</span>
        <p style={{ margin: "8px 0 0", color: "#6B7280" }}>No pending orders — all clear!</p>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h4 style={styles.heading}>Pending Orders ({orders.length})</h4>
        {onApprove && orders.length > 1 && (
          <button style={styles.batchBtn} onClick={() => onApprove("all")}>
            ✅ Approve All
          </button>
        )}
      </div>
      <div style={styles.list}>
        {orders.map((order) => {
          const skus = typeof order.skuList === "string" ? JSON.parse(order.skuList) : (order.skuList || []);
          return (
            <div key={order.id} style={styles.item}>
              <div style={styles.orderHeader}>
                <div>
                  <span style={styles.orderId}>#{order.id.slice(0, 8)}</span>
                  <span style={styles.userName}>{order.userName || "User"}</span>
                  {order.tierName && <TierBadge tierName={order.tierName} size="sm" />}
                </div>
                <span style={styles.date}>{new Date(order.createdAt).toLocaleDateString()}</span>
              </div>

              <div style={styles.packInfo}>
                <strong>{order.packName}</strong>
                <span style={styles.skuCount}>{skus.length} SKUs</span>
              </div>

              <div style={styles.skuRow}>
                {skus.slice(0, 5).map((sku, i) => (
                  <span key={i} style={styles.skuChip}>{sku}</span>
                ))}
                {skus.length > 5 && <span style={styles.moreChip}>+{skus.length - 5}</span>}
              </div>

              <div style={styles.payment}>
                {order.creditAmount > 0 && <span>💰 ${order.creditAmount.toFixed(2)} credits</span>}
                {order.cashAmount > 0 && <span>💵 ${order.cashAmount.toFixed(2)}</span>}
                <span style={styles.method}>{order.paymentMethod}</span>
              </div>

              <div style={styles.actions}>
                {onApprove && (
                  <button style={styles.approveBtn} onClick={() => onApprove(order.id)}>
                    ✅ Approve
                  </button>
                )}
                {onReject && (
                  <button style={styles.rejectBtn} onClick={() => onReject(order.id)}>
                    ❌ Reject
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  container: {},
  header: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px",
  },
  heading: { margin: 0, fontSize: "16px", fontWeight: 700 },
  batchBtn: {
    padding: "6px 14px", backgroundColor: "#059669", color: "#fff",
    border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  list: { display: "flex", flexDirection: "column", gap: "12px" },
  item: {
    padding: "16px", backgroundColor: "#fff", borderRadius: "10px",
    border: "1px solid #E5E7EB",
  },
  orderHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px",
  },
  orderId: { fontFamily: "monospace", fontSize: "12px", color: "#6366F1", marginRight: "8px" },
  userName: { fontWeight: 600, fontSize: "14px", marginRight: "8px" },
  date: { fontSize: "12px", color: "#6B7280" },
  packInfo: { display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" },
  skuCount: { fontSize: "12px", color: "#6B7280" },
  skuRow: { display: "flex", flexWrap: "wrap", gap: "4px", marginBottom: "8px" },
  skuChip: {
    fontSize: "10px", padding: "2px 6px", backgroundColor: "#EEF2FF",
    color: "#4338CA", borderRadius: "3px", fontFamily: "monospace",
  },
  moreChip: {
    fontSize: "10px", padding: "2px 6px", backgroundColor: "#F3F4F6",
    color: "#6B7280", borderRadius: "3px",
  },
  payment: { display: "flex", gap: "12px", fontSize: "13px", color: "#374151", marginBottom: "12px" },
  method: {
    fontSize: "11px", padding: "1px 6px", backgroundColor: "#F3F4F6",
    borderRadius: "3px", color: "#6B7280",
  },
  actions: { display: "flex", gap: "8px" },
  approveBtn: {
    padding: "6px 14px", backgroundColor: "#059669", color: "#fff",
    border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  rejectBtn: {
    padding: "6px 14px", backgroundColor: "#fff", color: "#DC2626",
    border: "1px solid #FCA5A5", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
  },
  empty: {
    textAlign: "center", padding: "32px", backgroundColor: "#F0FDF4",
    borderRadius: "12px", border: "1px solid #BBF7D0",
  },
};
