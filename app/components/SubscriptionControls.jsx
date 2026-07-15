/**
 * SubscriptionControls — Pause/Skip/Cancel buttons for subscription management
 */
import React, { useState } from "react";

export default function SubscriptionControls({ subscription, onAction }) {
  const [confirmAction, setConfirmAction] = useState(null);

  if (!subscription) return null;

  const isPaused = subscription.status === "PAUSED";
  const isCancelled = subscription.status === "CANCELLED";

  const handleAction = (action) => {
    if (action === "cancel" && confirmAction !== "cancel") {
      setConfirmAction("cancel");
      return;
    }
    setConfirmAction(null);
    if (onAction) onAction(action);
  };

  if (isCancelled) {
    return (
      <div style={styles.container}>
        <div style={styles.cancelled}>
          <span style={{ fontSize: "18px" }}>❌</span>
          <span>Subscription cancelled</span>
        </div>
        <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => handleAction("reactivate")}>
          Reactivate Subscription
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.buttonRow}>
        {isPaused ? (
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => handleAction("resume")}>
            ▶ Resume Subscription
          </button>
        ) : (
          <button style={{ ...styles.btn, ...styles.btnWarning }} onClick={() => handleAction("pause")}>
            ⏸ Pause Subscription
          </button>
        )}

        {!isPaused && subscription.canSkipNext && (
          <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => handleAction("skip")}>
            ⏭ Skip Next Month
          </button>
        )}
      </div>

      {confirmAction === "cancel" ? (
        <div style={styles.confirmBox}>
          <p style={{ margin: 0, fontWeight: 600, color: "#DC2626" }}>Are you sure you want to cancel?</p>
          <p style={{ margin: "4px 0 12px", fontSize: "13px", color: "#6B7280" }}>
            You'll lose access to subscriber benefits and store credits.
          </p>
          <div style={styles.buttonRow}>
            <button style={{ ...styles.btn, ...styles.btnDanger }} onClick={() => handleAction("cancel")}>
              Yes, Cancel Subscription
            </button>
            <button style={{ ...styles.btn, ...styles.btnOutline }} onClick={() => setConfirmAction(null)}>
              Keep My Subscription
            </button>
          </div>
        </div>
      ) : (
        <button style={{ ...styles.btn, ...styles.btnDangerOutline }} onClick={() => handleAction("cancel")}>
          Cancel Subscription
        </button>
      )}
    </div>
  );
}

const styles = {
  container: { display: "flex", flexDirection: "column", gap: "12px" },
  buttonRow: { display: "flex", gap: "8px", flexWrap: "wrap" },
  btn: {
    padding: "8px 16px", borderRadius: "8px", fontSize: "13px", fontWeight: 600,
    cursor: "pointer", border: "none", transition: "all 0.15s",
  },
  btnPrimary: { backgroundColor: "#2563EB", color: "#fff" },
  btnWarning: { backgroundColor: "#F59E0B", color: "#fff" },
  btnOutline: { backgroundColor: "#fff", color: "#374151", border: "1px solid #D1D5DB" },
  btnDanger: { backgroundColor: "#DC2626", color: "#fff" },
  btnDangerOutline: { backgroundColor: "#fff", color: "#DC2626", border: "1px solid #FCA5A5", fontSize: "12px" },
  confirmBox: {
    padding: "12px 16px", backgroundColor: "#FEF2F2", border: "1px solid #FCA5A5",
    borderRadius: "8px",
  },
  cancelled: {
    display: "flex", alignItems: "center", gap: "8px", padding: "12px",
    backgroundColor: "#F3F4F6", borderRadius: "8px", color: "#6B7280",
  },
};
