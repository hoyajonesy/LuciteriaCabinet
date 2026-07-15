/**
 * Admin Bulk Notifications — /admin/notifications
 * Compose and send notifications to user segments. View history.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Form, useActionData, useNavigation } from "@remix-run/react";
import { useState, useEffect } from "react";
import { prisma } from "../lib/db.server.js";
import { requireAdmin } from "../lib/admin-session.server.js";

export const loader = async ({ request }) => {
  await requireAdmin(request);

  const history = await prisma.bulkNotificationLog.findMany({
    orderBy: { sentAt: "desc" },
    take: 20,
  });

  const userCount = await prisma.user.count();
  const motivationCounts = await prisma.user.groupBy({ by: ["primaryMotivation"], _count: true });
  const tierCounts = await prisma.user.groupBy({ by: ["tier"], _count: true });

  return json({ history, userCount, motivationCounts, tierCounts });
};

export const action = async ({ request }) => {
  const admin = await requireAdmin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "send") {
    const subject = formData.get("subject")?.toString().trim();
    const body = formData.get("body")?.toString().trim();
    const segment = formData.get("segment") || "all";
    const motivationFilter = formData.get("motivationFilter") || "";
    const tierFilter = formData.get("tierFilter") || "";
    const statusFilter = formData.get("statusFilter") || "";

    if (!subject || !body) {
      return json({ error: "Subject and message body are required." }, { status: 400 });
    }

    // Build user filter
    const where = {};
    if (segment !== "all") {
      if (motivationFilter) {
        where.primaryMotivation = { contains: motivationFilter };
      }
      if (tierFilter) where.tier = tierFilter;
      if (statusFilter) where.status = statusFilter;
    }

    const users = await prisma.user.findMany({
      where,
      select: { id: true },
    });

    // Create in-app notification for each user
    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map(u => ({
          userId: u.id,
          category: "ADMIN",
          title: subject,
          body: body,
          icon: "📢",
        })),
      });
    }

    // Log the bulk notification
    const segmentDesc = segment === "all"
      ? "all"
      : JSON.stringify({ motivation: motivationFilter, tier: tierFilter, status: statusFilter });

    await prisma.bulkNotificationLog.create({
      data: {
        subject,
        body,
        segment: segmentDesc,
        recipientCount: users.length,
        sentBy: admin.email,
      },
    });

    return json({ success: true, count: users.length });
  }

  return json({ error: "Unknown action" }, { status: 400 });
};

export default function AdminNotifications() {
  const { history, userCount, motivationCounts, tierCounts } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();

  const [segment, setSegment] = useState("all");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [motivationFilter, setMotivationFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    if (actionData?.success) {
      setSubject("");
      setBody("");
    }
  }, [actionData]);

  return (
    <div>
      <h1 style={S.h1}>🔔 Bulk Notifications</h1>
      <p style={S.subtitle}>Send notifications to all or filtered user segments.</p>

      {actionData?.success && (
        <div style={S.toast}>✅ Notification sent to {actionData.count} user{actionData.count !== 1 ? "s" : ""}.</div>
      )}
      {actionData?.error && <div style={S.errorToast}>⚠️ {actionData.error}</div>}

      <div style={S.twoCol}>
        {/* Composer */}
        <div style={S.card}>
          <div style={S.cardHeader}><h3 style={S.cardTitle}>📝 Compose Notification</h3></div>
          <Form method="post" style={{ padding: 20 }}>
            <input type="hidden" name="intent" value="send" />
            <input type="hidden" name="motivationFilter" value={motivationFilter} />
            <input type="hidden" name="tierFilter" value={tierFilter} />
            <input type="hidden" name="statusFilter" value={statusFilter} />

            {/* Segment Selection */}
            <label style={S.label}>Audience</label>
            <div style={S.segmentRow}>
              <label style={S.radioLabel}>
                <input type="radio" name="segment" value="all" checked={segment === "all"} onChange={() => setSegment("all")} />
                All Users ({userCount})
              </label>
              <label style={S.radioLabel}>
                <input type="radio" name="segment" value="filtered" checked={segment === "filtered"} onChange={() => setSegment("filtered")} />
                Filtered Segment
              </label>
            </div>

            {segment === "filtered" && (
              <div style={S.filterSection}>
                <select value={motivationFilter} onChange={e => setMotivationFilter(e.target.value)} style={S.filterSelect}>
                  <option value="">Motivation: All</option>
                  <option value="inventory_management">Inventory Management</option>
                  <option value="social_sharing">Social Sharing</option>
                  <option value="acquisition_planning">Acquisition Planning</option>
                  <option value="investment_tracking">Investment Tracking</option>
                  <option value="just_exploring">Just Exploring</option>
                </select>
                <select value={tierFilter} onChange={e => setTierFilter(e.target.value)} style={S.filterSelect}>
                  <option value="">Tier: All</option>
                  <option value="Free">Free</option>
                  <option value="Collector">Collector</option>
                  <option value="Curator">Curator</option>
                </select>
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} style={S.filterSelect}>
                  <option value="">Status: All</option>
                  <option value="active">Active</option>
                  <option value="frozen">Frozen</option>
                </select>
              </div>
            )}

            <label style={S.label}>Subject</label>
            <input
              type="text" name="subject" required value={subject}
              onChange={e => setSubject(e.target.value)}
              placeholder="e.g. New Collection Format Available!"
              style={S.input}
            />

            <label style={S.label}>Message</label>
            <textarea
              name="body" rows={5} required value={body}
              onChange={e => setBody(e.target.value)}
              placeholder="Write your notification message..."
              style={S.textarea}
            />

            <button
              type="submit"
              style={S.sendBtn}
              disabled={navigation.state === "submitting"}
            >
              {navigation.state === "submitting" ? "Sending..." : "📤 Send Notification"}
            </button>
          </Form>
        </div>

        {/* Preview */}
        <div style={S.card}>
          <div style={S.cardHeader}><h3 style={S.cardTitle}>👁️ Preview</h3></div>
          <div style={{ padding: 20 }}>
            {subject || body ? (
              <div style={S.previewCard}>
                <div style={S.previewIcon}>📢</div>
                <div>
                  <div style={S.previewTitle}>{subject || "(No subject)"}</div>
                  <div style={S.previewBody}>{body || "(No message)"}</div>
                  <div style={S.previewMeta}>Just now · Admin Notification</div>
                </div>
              </div>
            ) : (
              <div style={S.emptyPreview}>Start typing to see a preview of the notification.</div>
            )}

            <div style={S.infoBox}>
              <strong>Delivery channels:</strong>
              <ul style={{ margin: "4px 0 0 16px", padding: 0, fontSize: 12 }}>
                <li>✅ In-app notification (immediate)</li>
                <li>📧 Email notification (queued)</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* History */}
      <div style={{ ...S.card, marginTop: 24 }}>
        <div style={S.cardHeader}><h3 style={S.cardTitle}>📋 Notification History</h3></div>
        {history.length === 0 ? (
          <div style={S.empty}>No notifications sent yet.</div>
        ) : (
          <table style={S.table}>
            <thead>
              <tr>
                <th style={S.th}>Subject</th>
                <th style={S.th}>Segment</th>
                <th style={{ ...S.th, textAlign: "center" }}>Recipients</th>
                <th style={S.th}>Sent By</th>
                <th style={S.th}>Date</th>
              </tr>
            </thead>
            <tbody>
              {history.map((n, i) => (
                <tr key={n.id} style={i % 2 ? S.altRow : {}}>
                  <td style={{ ...S.td, fontWeight: 600 }}>{n.subject}</td>
                  <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>
                    {n.segment === "all" ? "All Users" : n.segment}
                  </td>
                  <td style={{ ...S.td, textAlign: "center", fontWeight: 600 }}>{n.recipientCount}</td>
                  <td style={{ ...S.td, color: "#6b7280" }}>{n.sentBy}</td>
                  <td style={{ ...S.td, color: "#6b7280", fontSize: 12 }}>
                    {new Date(n.sentAt).toLocaleDateString()} {new Date(n.sentAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

const S = {
  h1: { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#6b7280", marginBottom: 20 },
  toast: { background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#166534", marginBottom: 16 },
  errorToast: { background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 6, padding: "10px 16px", fontSize: 13, color: "#991b1b", marginBottom: 16 },
  twoCol: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 },
  card: { background: "#fff", borderRadius: 8, border: "1px solid #e5e7eb", overflow: "hidden" },
  cardHeader: { padding: "14px 18px", borderBottom: "1px solid #e5e7eb" },
  cardTitle: { fontSize: 15, fontWeight: 700, color: "#111827", margin: 0 },
  label: { display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6, marginTop: 14 },
  input: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 13, resize: "vertical", outline: "none", boxSizing: "border-box" },
  segmentRow: { display: "flex", gap: 20, marginBottom: 4 },
  radioLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "#374151", cursor: "pointer" },
  filterSection: { display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" },
  filterSelect: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 4, fontSize: 12, background: "#fff" },
  sendBtn: { marginTop: 16, width: "100%", padding: "10px 0", background: "#374151", color: "#fff", border: "1px solid #1f2937", borderRadius: 6, fontSize: 14, fontWeight: 600, cursor: "pointer" },
  previewCard: { display: "flex", gap: 12, padding: 14, background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, marginBottom: 16 },
  previewIcon: { fontSize: 24, flexShrink: 0 },
  previewTitle: { fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4 },
  previewBody: { fontSize: 13, color: "#4b5563", lineHeight: 1.5 },
  previewMeta: { fontSize: 11, color: "#9ca3af", marginTop: 6 },
  emptyPreview: { padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13, background: "#f9fafb", borderRadius: 8 },
  infoBox: { padding: 14, background: "#f0f4ff", border: "1px solid #dbeafe", borderRadius: 6, fontSize: 13, color: "#1e40af" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th: { textAlign: "left", padding: "10px 18px", fontWeight: 600, fontSize: 11, textTransform: "uppercase", letterSpacing: "0.5px", color: "#6b7280", background: "#f9fafb", borderBottom: "1px solid #e5e7eb" },
  td: { padding: "10px 18px", color: "#374151", borderBottom: "1px solid #f3f4f6" },
  altRow: { background: "#fafafa" },
  empty: { padding: 30, textAlign: "center", color: "#9ca3af", fontSize: 13 },
};
