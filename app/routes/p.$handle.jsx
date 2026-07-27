/**
 * Public Collection Passport — /p/:handle  (public, no auth)
 *
 * The shareable collector profile page. Renders a published Passport with
 * hero, stats, featured elements, and a CTA back to the cabinet. Emits Open
 * Graph / Twitter metadata for rich link previews. When the handle is
 * unknown, the Passport is unpublished, or the feature flag is off, a
 * friendly "not published" page is shown (still with the Luciteria CTA).
 */
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { getFeatureFlag } from "../lib/feature-flags.server";
import { getPassportByHandle } from "../lib/passport.server";

const PASSPORT_FLAG = "feature_collection_passport";
const CABINET_URL = "https://cabinet.luciteria.com";
const PRIVACY_URL = "https://luciteria.com/policies/privacy-policy";

const MOTIVATION_LABELS = {
  INVENTORY: "Inventory keeper",
  SOCIAL: "Social collector",
  ACQUISITION: "Element hunter",
  INVESTMENT: "Long-term investor",
  DISCOVERY: "Curious explorer",
};

export const loader = async ({ params }) => {
  const handle = params.handle;

  const flagEnabled = await getFeatureFlag(PASSPORT_FLAG);
  if (!flagEnabled) {
    return json({ found: false, handle }, { status: 404 });
  }

  const passport = await getPassportByHandle(handle);
  if (!passport) {
    return json({ found: false, handle }, { status: 404 });
  }

  const memberSince = new Date(passport.memberSince).toLocaleDateString("en-GB", {
    month: "long",
    year: "numeric",
  });

  return json({
    found: true,
    handle: passport.handle,
    displayName: passport.displayName,
    bio: passport.bio,
    location: passport.location,
    favouriteElement: passport.favouriteElement,
    favouriteElementData: passport.favouriteElementData,
    motivation: passport.motivation,
    motivationLabel: passport.motivation ? MOTIVATION_LABELS[passport.motivation] || null : null,
    avatarUrl: passport.avatarUrl,
    memberSince,
    featuredElements: passport.featuredElements,
    stats: passport.stats,
  });
};

export const meta = ({ data }) => {
  if (!data || !data.found) {
    return [
      { title: "Collection Passport — Luciteria Cabinet" },
      { name: "description", content: "This collector's Passport hasn't been published yet." },
    ];
  }
  const title = `${data.displayName}'s Element Collection — Luciteria Cabinet`;
  const description = `${data.stats.completionPercent}% of the periodic table owned. ${data.stats.totalOwned} elements collected. See their cabinet and start your own.`;
  const url = `${CABINET_URL}/p/${data.handle}`;
  const image = `${CABINET_URL}/og/passport/${data.handle}`;

  return [
    { title },
    { name: "description", content: description },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { property: "og:image", content: image },
    { property: "og:url", content: url },
    { property: "og:type", content: "profile" },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
    { name: "twitter:image", content: image },
  ];
};

export default function PublicPassport() {
  const data = useLoaderData();

  if (!data.found) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.container, maxWidth: 560 }}>
          <div style={styles.notFoundCard}>
            <span style={{ fontSize: 40 }}>🔒</span>
            <h1 style={styles.notFoundTitle}>This Passport hasn't been published yet</h1>
            <p style={styles.notFoundText}>
              The collector may have set their Passport to private, or this link may be incorrect.
            </p>
          </div>
          {ctaSection()}
          {footer()}
        </div>
      </div>
    );
  }

  const {
    displayName,
    handle,
    bio,
    location,
    favouriteElementData,
    motivationLabel,
    avatarUrl,
    memberSince,
    featuredElements,
    stats,
  } = data;

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Brand */}
        <div style={styles.brand}>
          <span style={{ fontSize: 24 }}>⚛️</span>
          <span style={styles.brandName}>Luciteria Collector Cabinet</span>
        </div>

        {/* Hero */}
        <div style={styles.hero}>
          <img
            src={avatarUrl || "/images/default-avatar.svg"}
            alt={displayName}
            style={styles.avatar}
          />
          <h1 style={styles.name}>{displayName}</h1>
          <p style={styles.handle}>@{handle}</p>
          {bio && <p style={styles.bio}>{bio}</p>}
          <div style={styles.badgeRow}>
            {location && (
              <span style={styles.badge}>📍 {location}</span>
            )}
            {favouriteElementData && (
              <span style={styles.badge}>
                ★ Favourite: {favouriteElementData.name} ({favouriteElementData.symbol})
              </span>
            )}
            {motivationLabel && <span style={styles.badge}>{motivationLabel}</span>}
          </div>
          <p style={styles.memberSince}>Collector since {memberSince}</p>
        </div>

        {/* Stats bar */}
        <div style={styles.statsBar}>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{stats.completionPercent}%</span>
            <span style={styles.statLabel}>Complete</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{stats.totalOwned}</span>
            <span style={styles.statLabel}>Elements</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{stats.setsCompleted}</span>
            <span style={styles.statLabel}>Sets Complete</span>
          </div>
          <div style={styles.statBox}>
            <span style={styles.statValue}>{stats.formatsCollected.length}</span>
            <span style={styles.statLabel}>Formats</span>
          </div>
        </div>

        {stats.formatsCollected.length > 0 && (
          <div style={styles.formatRow}>
            {stats.formatsCollected.map((f) => (
              <span key={f.id} style={styles.formatBadge}>
                {f.icon} {f.name}
              </span>
            ))}
          </div>
        )}

        {/* Featured elements */}
        {featuredElements.length > 0 && (
          <div style={styles.section}>
            <h2 style={styles.sectionTitle}>Featured Elements</h2>
            <div style={styles.featuredGrid}>
              {featuredElements.map((el) => (
                <div key={el.symbol} style={styles.featuredCard}>
                  <div style={styles.featuredImageWrap}>
                    {el.imageUrl ? (
                      <img src={el.imageUrl} alt={el.name} style={styles.featuredImage} />
                    ) : (
                      <div style={styles.noImageCard}>
                        <span style={styles.noImageSymbol}>{el.symbol}</span>
                      </div>
                    )}
                  </div>
                  <div style={styles.featuredMeta}>
                    <span style={styles.featuredName}>{el.name}</span>
                    <span style={styles.featuredSub}>
                      #{el.atomicNumber}{el.formatName ? ` · ${el.formatName}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {ctaSection()}
        {footer()}
      </div>
    </div>
  );
}

function ctaSection() {
  return (
    <div style={styles.cta}>
      <span style={{ fontSize: 30 }}>⚛️</span>
      <h2 style={styles.ctaTitle}>Build your own cabinet</h2>
      <p style={styles.ctaText}>
        Luciteria Collector Cabinet helps you track, showcase, and complete your
        element collection. Create your own free collector Passport.
      </p>
      <a href={CABINET_URL} style={styles.ctaButton}>
        Get Started →
      </a>
    </div>
  );
}

function footer() {
  return (
    <div style={styles.footer}>
      <a href={CABINET_URL} style={styles.footerLink}>cabinet.luciteria.com</a>
      <span style={styles.footerDot}>·</span>
      <a href={PRIVACY_URL} style={styles.footerLink} target="_blank" rel="noreferrer">
        Privacy Policy
      </a>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "#f5f7fa",
    padding: "32px 16px",
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    color: "#1a1a2e",
  },
  container: { maxWidth: 720, margin: "0 auto" },
  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 24,
  },
  brandName: { fontSize: 15, fontWeight: 600, color: "#6b7280" },
  hero: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: "32px 24px",
    textAlign: "center",
    marginBottom: 16,
  },
  avatar: {
    width: 96,
    height: 96,
    borderRadius: "50%",
    objectFit: "cover",
    border: "3px solid #e5e7eb",
    background: "#f3f4f6",
    marginBottom: 12,
  },
  name: { fontSize: 26, fontWeight: 700, margin: "0 0 2px" },
  handle: { fontSize: 15, color: "#9ca3af", margin: "0 0 12px" },
  bio: { fontSize: 15, color: "#4b5563", margin: "0 auto 16px", maxWidth: 520, lineHeight: 1.5 },
  badgeRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 12,
  },
  badge: {
    fontSize: 13,
    background: "#f3f4f6",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "4px 12px",
    color: "#374151",
  },
  memberSince: { fontSize: 12, color: "#9ca3af", margin: 0 },
  statsBar: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 16,
  },
  statBox: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    padding: "16px 8px",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  statValue: { fontSize: 22, fontWeight: 700, color: "#1a2744" },
  statLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "0.04em", color: "#9ca3af" },
  formatRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
    marginBottom: 24,
  },
  formatBadge: {
    fontSize: 13,
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 999,
    padding: "5px 14px",
    color: "#374151",
  },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: 700, margin: "0 0 14px", textAlign: "center" },
  featuredGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(130px, 1fr))",
    gap: 14,
  },
  featuredCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 12,
    overflow: "hidden",
  },
  featuredImageWrap: { width: "100%", aspectRatio: "1 / 1", background: "#f3f4f6" },
  featuredImage: { width: "100%", height: "100%", objectFit: "cover" },
  noImageCard: {
    width: "100%",
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "linear-gradient(135deg, #1a2744, #2ec4b6)",
  },
  noImageSymbol: { fontSize: 34, fontWeight: 700, color: "#fff" },
  featuredMeta: { padding: "10px 12px", display: "flex", flexDirection: "column", gap: 2 },
  featuredName: { fontSize: 14, fontWeight: 600 },
  featuredSub: { fontSize: 12, color: "#9ca3af" },
  cta: {
    background: "linear-gradient(135deg, #1a2744, #26344f)",
    borderRadius: 16,
    padding: "36px 24px",
    textAlign: "center",
    color: "#fff",
    marginTop: 8,
    marginBottom: 20,
  },
  ctaTitle: { fontSize: 22, fontWeight: 700, margin: "12px 0 8px", color: "#fff" },
  ctaText: {
    fontSize: 14,
    color: "#c7cfdd",
    margin: "0 auto 20px",
    maxWidth: 440,
    lineHeight: 1.5,
  },
  ctaButton: {
    display: "inline-block",
    background: "#2ec4b6",
    color: "#fff",
    fontWeight: 600,
    fontSize: 15,
    padding: "12px 28px",
    borderRadius: 8,
    textDecoration: "none",
  },
  notFoundCard: {
    background: "#fff",
    border: "1px solid #e5e7eb",
    borderRadius: 16,
    padding: "40px 24px",
    textAlign: "center",
    marginBottom: 20,
  },
  notFoundTitle: { fontSize: 20, fontWeight: 700, margin: "16px 0 8px" },
  notFoundText: { fontSize: 14, color: "#6b7280", margin: 0, lineHeight: 1.5 },
  footer: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    padding: "20px 0",
  },
  footerLink: { fontSize: 13, color: "#6b7280", textDecoration: "none" },
  footerDot: { color: "#d1d5db" },
};
