/**
 * User Profile & Settings — /profile
 * 
 * - Update email, name, password
 * - Change subscription status (upgrade collector to subscriber)
 * - Change subscription format
 * - View and manage wishlist token
 * 
 * TODO PRODUCTION: Replace password management with Shopify OAuth.
 * Profile changes should sync with Shopify customer records.
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, Link } from "@remix-run/react";
import { useState } from "react";
import Toast from "../components/Toast";
import { getUserById, updateUser, updatePassword, regenerateWishlistToken } from "../lib/auth.server";
import { requireUserId } from "../lib/session.server";
import { prisma } from "../lib/db.server";
import TierBadge from "../components/TierBadge";
import CreditBalance from "../components/CreditBalance";

const FORMAT_LABELS = {
  "10mm": "10mm Cubes",
  "25.4mm": "25.4mm Cubes (1 inch)",
  "50mm": "50mm Cubes",
  "lucite": "Lucite Cubes",
  "ampoules": "Ampoules",
};

export const loader = async ({ request }) => {
  const userId = await requireUserId(request);
  const user = await getUserById(userId);
  if (!user) return redirect("/onboarding/welcome");

  // Fetch membership info
  const fullUser = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      membershipTier: true,
      userSubscriptions: { include: { tier: true }, orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  const subscription = fullUser?.userSubscriptions?.[0] || null;

  return json({
    user: {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      isSubscriber: user.isSubscriber,
      userType: user.userType,
      subscriptionFormat: user.subscriptionFormat,
      trackedFormats: user.trackedFormats,
      wishlistToken: user.wishlistToken,
      ownedCount: user.ownedElements.length,
      wishlistCount: user.wishlistElements.length,
      createdAt: user.createdAt,
      storeCreditBalance: fullUser?.storeCreditBalance ?? 0,
      subscriptionStatus: fullUser?.subscriptionStatus ?? "NONE",
      tierName: fullUser?.membershipTier?.name || null,
      tierDisplayName: fullUser?.membershipTier?.displayName || null,
    },
    subscription: subscription ? {
      status: subscription.status,
      billingCycle: subscription.billingCycle,
      nextBillingDate: subscription.nextBillingDate,
      tierName: subscription.tier?.displayName,
    } : null,
  });
};

export const action = async ({ request }) => {
  const userId = await requireUserId(request);
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "update-profile") {
    const firstName = formData.get("firstName");
    const lastName = formData.get("lastName");
    const email = formData.get("email");
    if (!firstName || !lastName || !email) return json({ error: "First name, last name, and email are required.", intent }, { status: 400 });
    try {
      await updateUser(userId, { firstName: firstName.trim(), lastName: lastName.trim(), email: email.toLowerCase().trim() });
      return json({ success: "Profile updated successfully!", intent });
    } catch (err) {
      if (err.code === "P2002") return json({ error: "This email is already taken.", intent }, { status: 400 });
      return json({ error: "Failed to update profile.", intent }, { status: 500 });
    }
  }

  if (intent === "update-password") {
    const currentPassword = formData.get("currentPassword");
    const newPassword = formData.get("newPassword");
    const result = await updatePassword(userId, currentPassword, newPassword);
    if (!result.success) return json({ error: result.error, intent }, { status: 400 });
    return json({ success: "Password updated successfully!", intent });
  }

  if (intent === "update-subscription") {
    const userType = formData.get("userType");
    const subscriptionFormat = formData.get("subscriptionFormat");
    const data = {
      userType: userType || "collector",
      isSubscriber: userType === "subscriber",
    };
    if (userType === "subscriber" && subscriptionFormat) {
      data.subscriptionFormat = subscriptionFormat;
    }
    await updateUser(userId, data);
    return json({ success: "Subscription settings updated!", intent });
  }

  if (intent === "regenerate-token") {
    await regenerateWishlistToken(userId);
    return json({ success: "Wishlist link regenerated!", intent });
  }

  return json({ error: "Unknown action.", intent }, { status: 400 });
};

export default function Profile() {
  const { user, subscription } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state === "submitting";

  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const shareUrl = typeof window !== "undefined"
    ? `${window.location.origin}/wishlist/${user.wishlistToken}`
    : `/wishlist/${user.wishlistToken}`;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <Link to="/app/cabinet" style={styles.backLink}>← Back to Cabinet</Link>
          <h1 style={styles.title}>⚙️ Settings</h1>
          <p style={styles.subtitle}>Manage your profile, subscription, and wishlist sharing.</p>
        </div>

        {/* Toasts */}
        {actionData?.success && <Toast message={actionData.success} type="success" />}
        {actionData?.error && <Toast message={actionData.error} type="error" />}

        {/* Membership Status Widget */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🏆 Membership Status</h3>
          <div style={styles.membershipRow}>
            <div>
              <div style={styles.memberLabel}>Tier</div>
              {user.tierName ? (
                <TierBadge tierName={user.tierName} size="md" />
              ) : (
                <span style={{ fontSize: 14, color: "#9CA3AF" }}>No membership</span>
              )}
            </div>
            <div>
              <div style={styles.memberLabel}>Status</div>
              <span style={{
                display: "inline-block", padding: "3px 10px", borderRadius: 8, fontSize: 13, fontWeight: 600,
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
            <div>
              <CreditBalance amount={user.storeCreditBalance} size="sm" />
            </div>
          </div>
          {subscription && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid #F3F4F6", display: "flex", gap: 24, fontSize: 13, color: "#6B7280" }}>
              <span>Next Billing: {new Date(subscription.nextBillingDate).toLocaleDateString()}</span>
              <span>Cycle: {subscription.billingCycle}</span>
            </div>
          )}
          <Link to="/app/cabinet/membership" style={{ ...styles.saveBtn, display: "inline-block", marginTop: 12, textDecoration: "none", textAlign: "center" }}>
            Manage Subscription →
          </Link>
        </div>

        {/* Profile Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>👤 Profile</h3>
          <Form method="post">
            <input type="hidden" name="intent" value="update-profile" />
            <div style={styles.formGrid}>
              <div style={styles.field}>
                <label style={styles.label}>First Name</label>
                <input name="firstName" defaultValue={user.firstName} required style={styles.input} />
              </div>
              <div style={styles.field}>
                <label style={styles.label}>Last Name</label>
                <input name="lastName" defaultValue={user.lastName} required style={styles.input} />
              </div>
            </div>
            <div style={{ ...styles.field, marginBottom: 14 }}>
              <label style={styles.label}>Email</label>
              <input name="email" type="email" defaultValue={user.email} required style={styles.input} />
            </div>
            <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
              {isSubmitting && actionData?.intent === "update-profile" ? "Saving..." : "Save Profile"}
            </button>
          </Form>

          {/* Password */}
          <div style={styles.divider} />
          <button onClick={() => setShowPasswordForm(!showPasswordForm)} style={styles.textBtn}>
            {showPasswordForm ? "Cancel" : "Change Password"}
          </button>
          {showPasswordForm && (
            <Form method="post" style={{ marginTop: 12 }}>
              <input type="hidden" name="intent" value="update-password" />
              <div style={styles.formGrid}>
                <div style={styles.field}>
                  <label style={styles.label}>Current Password</label>
                  <input name="currentPassword" type="password" required style={styles.input} />
                </div>
                <div style={styles.field}>
                  <label style={styles.label}>New Password</label>
                  <input name="newPassword" type="password" required minLength={6} style={styles.input} />
                </div>
              </div>
              <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
                Update Password
              </button>
            </Form>
          )}
          {/* TODO PRODUCTION: Remove password section — Shopify OAuth handles auth */}
        </div>

        {/* Subscription Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>
            {user.isSubscriber ? "📬 Subscription" : "🗄️ Collection Type"}
          </h3>
          <Form method="post">
            <input type="hidden" name="intent" value="update-subscription" />
            <div style={styles.field}>
              <label style={styles.label}>I am a...</label>
              <select name="userType" defaultValue={user.userType} style={styles.select}>
                <option value="subscriber">Cube of the Month Subscriber</option>
                <option value="collector">Independent Collector</option>
              </select>
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Subscription Format</label>
              <select name="subscriptionFormat" defaultValue={user.subscriptionFormat || ""} style={styles.select}>
                <option value="">Select format...</option>
                {Object.entries(FORMAT_LABELS).map(([id, label]) => (
                  <option key={id} value={id}>{label}</option>
                ))}
              </select>
              <span style={styles.hint}>
                This determines which products are included in your subscription and filtered views.
              </span>
            </div>
            <button type="submit" disabled={isSubmitting} style={styles.saveBtn}>
              Save Subscription Settings
            </button>
          </Form>
        </div>

        {/* Wishlist Sharing Section */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>🎁 Wishlist Sharing</h3>
          <p style={styles.cardDesc}>
            Your wishlist has a unique shareable link. Anyone with the link can see what elements you want.
          </p>
          <div style={styles.urlRow}>
            <input readOnly value={shareUrl} style={styles.urlInput} onClick={(e) => e.target.select()} />
            <button
              onClick={() => navigator.clipboard?.writeText(shareUrl)}
              style={styles.copyBtn}
            >
              📋 Copy
            </button>
          </div>
          <Form method="post" style={{ marginTop: 12 }}>
            <input type="hidden" name="intent" value="regenerate-token" />
            <button type="submit" style={styles.dangerBtn}>
              🔄 Regenerate Link
            </button>
            <span style={styles.hint}>
              This invalidates the old link. Anyone with the previous link will no longer be able to view your wishlist.
            </span>
          </Form>
        </div>

        {/* Account Stats */}
        <div style={styles.card}>
          <h3 style={styles.cardTitle}>📊 Account Summary</h3>
          <div style={styles.statsGrid}>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{user.ownedCount}</span>
              <span style={styles.statLabel}>Elements Owned</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{user.wishlistCount}</span>
              <span style={styles.statLabel}>Wishlisted</span>
            </div>
            <div style={styles.statItem}>
              <span style={styles.statValue}>{118 - user.ownedCount}</span>
              <span style={styles.statLabel}>Missing</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <div style={styles.logoutSection}>
          <Form method="post" action="/logout">
            <button type="submit" style={styles.logoutBtn}>
              Log Out
            </button>
          </Form>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--luc-bg, #f5f7fa)",
    padding: "32px 20px",
  },
  container: { maxWidth: 640, margin: "0 auto" },
  header: { marginBottom: 28 },
  backLink: {
    fontSize: 13,
    color: "var(--luc-accent, #4A90E2)",
    textDecoration: "none",
    display: "inline-block",
    marginBottom: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    margin: "0 0 6px",
  },
  subtitle: {
    fontSize: 14,
    color: "var(--luc-text-muted, #6b7280)",
    margin: 0,
  },
  card: {
    background: "#fff",
    border: "1px solid var(--luc-border, #e2e5ea)",
    borderRadius: 14,
    padding: "24px 28px",
    marginBottom: 20,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    margin: "0 0 16px",
  },
  cardDesc: {
    fontSize: 13,
    color: "var(--luc-text-muted, #6b7280)",
    lineHeight: 1.4,
    marginBottom: 14,
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 14,
    marginBottom: 14,
  },
  field: { display: "flex", flexDirection: "column", gap: 5, marginBottom: 12 },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--luc-text, #1a1a2e)",
  },
  input: {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #e2e5ea)",
    fontSize: 14,
    outline: "none",
    color: "var(--luc-text, #1a1a2e)",
  },
  select: {
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #e2e5ea)",
    fontSize: 14,
    outline: "none",
    background: "#fff",
    color: "var(--luc-text, #1a1a2e)",
  },
  hint: {
    fontSize: 12,
    color: "var(--luc-text-muted, #6b7280)",
    marginTop: 4,
    display: "block",
  },
  saveBtn: {
    padding: "10px 22px",
    borderRadius: 8,
    border: "none",
    background: "var(--luc-accent, #4A90E2)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  divider: {
    height: 1,
    background: "var(--luc-border, #e2e5ea)",
    margin: "16px 0",
  },
  textBtn: {
    background: "none",
    border: "none",
    color: "var(--luc-accent, #4A90E2)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: 0,
  },
  urlRow: { display: "flex", gap: 8 },
  urlInput: {
    flex: 1,
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #e2e5ea)",
    fontSize: 12,
    fontFamily: "monospace",
    color: "var(--luc-text-muted, #6b7280)",
    background: "var(--luc-bg, #f5f7fa)",
    outline: "none",
  },
  copyBtn: {
    padding: "8px 14px",
    borderRadius: 8,
    border: "none",
    background: "var(--luc-accent, #4A90E2)",
    color: "#fff",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  dangerBtn: {
    padding: "8px 16px",
    borderRadius: 8,
    border: "1px solid var(--luc-danger, #dc2626)",
    background: "#fff",
    color: "var(--luc-danger, #dc2626)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 14,
  },
  statItem: {
    textAlign: "center",
    padding: "12px 8px",
    background: "var(--luc-bg, #f5f7fa)",
    borderRadius: 10,
  },
  statValue: {
    display: "block",
    fontSize: 24,
    fontWeight: 700,
    color: "var(--luc-accent, #4A90E2)",
  },
  statLabel: {
    display: "block",
    fontSize: 12,
    color: "var(--luc-text-muted, #6b7280)",
    marginTop: 2,
  },
  logoutSection: {
    textAlign: "center",
    padding: "20px 0",
  },
  logoutBtn: {
    padding: "10px 28px",
    borderRadius: 8,
    border: "1px solid var(--luc-border, #e2e5ea)",
    background: "#fff",
    color: "var(--luc-text-muted, #6b7280)",
    fontSize: 14,
    fontWeight: 500,
    cursor: "pointer",
  },
  membershipRow: {
    display: "flex",
    gap: 24,
    alignItems: "flex-start",
    flexWrap: "wrap",
  },
  memberLabel: {
    fontSize: 11,
    color: "#6B7280",
    textTransform: "uppercase",
    marginBottom: 4,
    fontWeight: 600,
  },
};
