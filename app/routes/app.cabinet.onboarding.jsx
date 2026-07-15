/**
 * Collection Type Onboarding Page (Phase 2)
 * 
 * Customer selects their collection type during signup.
 * Collection type is locked in Phase 2 (multi-collection in future phases).
 * 
 * Types: 10mm cubes, 25.4mm cubes, 50mm cubes, lucite cubes, ampoules
 */
import { json, redirect } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import AppNav from "../components/AppNav";
import { getAvailableCount } from "../data/elements.server.js";

export const loader = ({ request }) => {
  // Route gated: not part of the main-dashboard nav. Redirect to dashboard.
  return redirect("/app/cabinet");
  const url = new URL(request.url);
  const customerId = url.searchParams.get("customer") || "cust_001";

  const collectionTypes = [
    {
      id: "lucite",
      name: "Lucite Cubes",
      icon: "🧊",
      description: "Beautiful transparent acrylic cubes with embedded element samples. The flagship Luciteria format — perfect for display.",
      priceRange: "$29 – $149",
      elementCount: getAvailableCount("lucite"),
      features: ["Crystal clear display", "Embedded element samples", "50mm standard size", "UV resistant"],
      popular: true,
    },
    {
      id: "10mm",
      name: "10mm Metal Cubes",
      icon: "🔲",
      description: "Precision-machined 10mm metal cubes. Compact, tactile, and perfect for collectors who appreciate density in miniature.",
      priceRange: "$15 – $89",
      elementCount: getAvailableCount("10mm"),
      features: ["Precision machined", "Pocket-sized", "Pure metal", "Great starter set"],
    },
    {
      id: "25.4mm",
      name: "25.4mm (1 inch) Cubes",
      icon: "📦",
      description: "One-inch metal cubes — the goldilocks size. Substantial enough to feel real, compact enough for a shelf display.",
      priceRange: "$39 – $199",
      elementCount: getAvailableCount("25.4mm"),
      features: ["1 inch standard", "Hefty feel", "Shelf display ready", "Engraved details"],
    },
    {
      id: "50mm",
      name: "50mm Metal Cubes",
      icon: "🗄️",
      description: "Premium 50mm cubes for the serious collector. Impressive desk presence and museum-quality craftsmanship.",
      priceRange: "$79 – $399",
      elementCount: getAvailableCount("50mm"),
      features: ["Museum quality", "Desktop statement", "Premium finish", "Collector's grade"],
    },
    {
      id: "ampoules",
      name: "Sealed Ampoules",
      icon: "🧪",
      description: "Elements sealed in glass ampoules under inert atmosphere. The scientific collector's choice for reactive elements.",
      priceRange: "$19 – $129",
      elementCount: getAvailableCount("ampoules"),
      features: ["Inert atmosphere", "Scientific grade", "Glass sealed", "Unique form factor"],
    },
  ];

  return json({ customerId, collectionTypes });
};

export default function OnboardingPage() {
  const { customerId, collectionTypes } = useLoaderData();

  return (
    <div style={styles.layout}>
      <AppNav mode="customer" customerName="New Collector" />
      <main style={styles.main} className="luc-main">
        <div style={styles.header}>
          <h1 style={styles.title}>Choose Your Collection</h1>
          <p style={styles.subtitle}>
            Every collector starts with a format. Pick the one that speaks to you.
            <br />
            <span style={styles.lockNote}>
              🔒 In the current phase, your collection type is locked once chosen. 
              Multi-collection support coming soon.
            </span>
          </p>
        </div>

        <div style={styles.grid}>
          {collectionTypes.map((ct) => (
            <div
              key={ct.id}
              style={{
                ...styles.card,
                ...(ct.popular ? styles.cardPopular : {}),
              }}
            >
              {ct.popular && <div style={styles.popularBadge}>Most Popular</div>}
              <div style={styles.cardIcon}>{ct.icon}</div>
              <h3 style={styles.cardName}>{ct.name}</h3>
              <p style={styles.cardDesc}>{ct.description}</p>
              
              <div style={styles.cardStats}>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{ct.elementCount}</span>
                  <span style={styles.statLabel}>Elements Available</span>
                </div>
                <div style={styles.stat}>
                  <span style={styles.statValue}>{ct.priceRange}</span>
                  <span style={styles.statLabel}>Price Range</span>
                </div>
              </div>

              <ul style={styles.featureList}>
                {ct.features.map((f, i) => (
                  <li key={i} style={styles.feature}>✓ {f}</li>
                ))}
              </ul>

              <Link
                to={`/app/cabinet?customer=${customerId}&collection=${ct.id}`}
                style={{
                  ...styles.selectBtn,
                  ...(ct.popular ? styles.selectBtnPopular : {}),
                }}
              >
                Select {ct.name}
              </Link>
            </div>
          ))}
        </div>

        <div style={styles.infoBox}>
          <h4 style={styles.infoTitle}>💡 Not sure which to pick?</h4>
          <p style={styles.infoText}>
            <strong>Lucite Cubes</strong> are our most popular — they're stunning on display and cover the widest range of elements.
            <strong> 10mm Cubes</strong> are great for budget-conscious collectors who want pure metal.
            <strong> Ampoules</strong> are perfect for chemistry enthusiasts who love the scientific aesthetic.
          </p>
        </div>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh" },
  main: { marginLeft: 240, flex: 1, padding: "24px 40px 60px", maxWidth: 1100 },
  header: { textAlign: "center", marginBottom: 40 },
  title: { fontSize: 32, fontWeight: 800, color: "var(--luc-text)", margin: 0 },
  subtitle: { fontSize: 15, color: "var(--luc-text-muted)", marginTop: 8, lineHeight: 1.6 },
  lockNote: {
    display: "inline-block",
    marginTop: 8,
    fontSize: 12,
    color: "var(--luc-text-muted)",
    background: "#f9fafb",
    padding: "4px 10px",
    borderRadius: 6,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
    marginBottom: 40,
  },
  card: {
    background: "#ffffff",
    border: "1px solid var(--luc-border)",
    borderRadius: 16,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    position: "relative",
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
    transition: "box-shadow 0.2s ease, transform 0.2s ease",
  },
  cardPopular: {
    borderColor: "var(--luc-accent)",
    borderWidth: 2,
    boxShadow: "0 4px 12px rgba(74,144,226,0.15)",
  },
  popularBadge: {
    position: "absolute",
    top: -10,
    right: 16,
    background: "var(--luc-accent)",
    color: "#fff",
    padding: "3px 10px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 700,
  },
  cardIcon: { fontSize: 40, marginBottom: 12 },
  cardName: { fontSize: 20, fontWeight: 700, color: "var(--luc-text)", margin: "0 0 8px" },
  cardDesc: { fontSize: 13, color: "var(--luc-text-muted)", lineHeight: 1.5, margin: "0 0 16px", flex: 1 },
  cardStats: { display: "flex", gap: 16, marginBottom: 16 },
  stat: { display: "flex", flexDirection: "column" },
  statValue: { fontSize: 16, fontWeight: 700, color: "var(--luc-accent)" },
  statLabel: { fontSize: 10, color: "var(--luc-text-muted)", textTransform: "uppercase", fontWeight: 600 },
  featureList: {
    listStyle: "none",
    padding: 0,
    margin: "0 0 16px",
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 13,
    color: "var(--luc-text-muted)",
  },
  feature: {},
  selectBtn: {
    display: "block",
    textAlign: "center",
    padding: "10px 16px",
    borderRadius: 8,
    border: "1px solid var(--luc-accent)",
    background: "transparent",
    color: "var(--luc-accent)",
    fontSize: 14,
    fontWeight: 600,
    textDecoration: "none",
    transition: "background 0.15s ease",
  },
  selectBtnPopular: {
    background: "var(--luc-accent)",
    color: "#ffffff",
  },
  infoBox: {
    background: "#f8fafc",
    border: "1px solid var(--luc-border)",
    borderRadius: 12,
    padding: 20,
  },
  infoTitle: { fontSize: 15, fontWeight: 700, color: "var(--luc-text)", margin: "0 0 8px" },
  infoText: { fontSize: 13, color: "var(--luc-text-muted)", lineHeight: 1.6, margin: 0 },
};
