/**
 * Public Wishlist View — /wishlist/:token
 * 
 * Shows a user's wishlist elements without requiring login.
 * Includes read-only periodic table visualization and element list.
 * Shareable link for gift registries.
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { useState } from "react";
import { getUserByWishlistToken } from "../lib/auth.server";
import { ELEMENTS_118 } from "../data/elements.server";
import { prisma } from "../lib/db.server";
import { productUrlForShopProduct } from "../lib/format-display";

export const loader = async ({ params }) => {
  const { token } = params;
  if (!token) throw new Response("Not Found", { status: 404 });

  const user = await getUserByWishlistToken(token);
  if (!user) throw new Response("Wishlist not found", { status: 404 });

  const collectionItems = await prisma.collectionItem.findMany({
    where: { userId: user.id }
  });

  const wishlistItems = collectionItems.filter(item => item.state === "WANTED");
  const wishlistSymbols = wishlistItems.map(e => e.elementSymbol);
  const ownedSymbols = collectionItems.filter(item => item.state === "OWNED").map(e => e.elementSymbol);

  // Map products to extract handle and variant ID
  const allProducts = await prisma.product.findMany();
  const productMap = new Map(allProducts.map(p => [p.sku, p]));
  const preferredFormat = user.subscriptionFormat || "lucite_cube";

  const wishlistElementsResolved = wishlistItems.map((it) => {
    const el = ELEMENTS_118.find((e) => e.sym === it.elementSymbol);
    let variant = null;

    if (it.format && el?.productsByFormat?.[it.format]) {
      variant = el.productsByFormat[it.format];
    } else if (preferredFormat && el?.productsByFormat?.[preferredFormat]) {
      variant = el.productsByFormat[preferredFormat];
    } else if (el?.products && el.products.length > 0) {
      variant = el.products[0];
    }

    const dbProduct = variant?.sku ? productMap.get(variant.sku) : null;
    const productHandle = dbProduct?.handle || variant?.handle || null;
    const variantId = dbProduct?.shopifyVariantId || variant?.variantId || null;

    return {
      id: it.id,
      elementSymbol: it.elementSymbol,
      elementName: variant?.title || it.elementName,
      atomicNumber: it.atomicNumber,
      productHandle,
      variantId,
    };
  });

  return json({
    userName: `${user.firstName} ${user.lastName}`,
    wishlistElements: wishlistElementsResolved,
    ownedCount: ownedSymbols.length,
  });
};

export default function PublicWishlist() {
  const { userName, wishlistElements, ownedCount } = useLoaderData();
  const [hoveredId, setHoveredId] = useState(null);

  return (
    <div style={styles.page}>
      <div style={styles.container}>
        {/* Header */}
        <div style={styles.header}>
          <div style={styles.brand}>
            <span style={{ fontSize: 28 }}>⚛️</span>
            <span style={styles.brandName}>Luciteria Collector Cabinet</span>
          </div>
          <h1 style={styles.title}>{userName}'s Element Wishlist</h1>
          <p style={styles.subtitle}>
            {wishlistElements.length > 0
              ? `${userName} is looking for ${wishlistElements.length} element${wishlistElements.length !== 1 ? "s" : ""}. Help them complete their collection!`
              : `${userName} hasn't added any elements to their wishlist yet.`}
          </p>
          <div style={styles.statRow}>
            <span style={styles.stat}>🧊 {ownedCount} collected</span>
            <span style={styles.stat}>⭐ {wishlistElements.length} wishlisted</span>
            <span style={styles.stat}>🔍 {118 - ownedCount} missing</span>
          </div>
        </div>

        {/* Wishlist Items */}
        {wishlistElements.length > 0 && (
          <div style={styles.wishlistSection}>
            <h3 style={styles.sectionTitle}>⭐ Wishlist Items</h3>
            <div style={styles.wishlistGrid}>
              {wishlistElements.map((el) => {
                const url = productUrlForShopProduct({ handle: el.productHandle, variantId: el.variantId }, el.elementName);
                return (
                  <a
                    key={el.id}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    onMouseEnter={() => setHoveredId(el.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      ...styles.wishlistCardLink,
                      transform: hoveredId === el.id ? "translateY(-2px)" : "translateY(0)",
                      boxShadow: hoveredId === el.id ? "0 4px 12px rgba(0,0,0,0.08)" : "none",
                      borderColor: hoveredId === el.id ? "#4a90e2" : "#e3f2fd",
                    }}
                  >
                    <span style={styles.elSymbol}>{el.elementSymbol}</span>
                    <div>
                      <span style={styles.elName}>{el.elementName}</span>
                      <span style={styles.elNumber}>#{el.atomicNumber}</span>
                    </div>
                  </a>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div style={styles.footer}>
          <p style={styles.footerText}>
            Powered by <strong>Luciteria Collector Cabinet</strong>
          </p>
          <Link to="/onboarding/welcome" style={styles.footerLink}>
            Start your own collection →
          </Link>
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
  container: {
    maxWidth: 900,
    margin: "0 auto",
  },
  header: { textAlign: "center", marginBottom: 32 },
  brand: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  brandName: {
    fontSize: 16,
    fontWeight: 600,
    color: "var(--luc-text-muted, #6b7280)",
  },
  title: {
    fontSize: 28,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    margin: "0 0 8px",
  },
  subtitle: {
    fontSize: 15,
    color: "var(--luc-text-muted, #6b7280)",
    lineHeight: 1.5,
  },
  statRow: {
    display: "flex",
    justifyContent: "center",
    gap: 20,
    marginTop: 14,
  },
  stat: {
    fontSize: 13,
    color: "var(--luc-text, #1a1a2e)",
    fontWeight: 500,
  },
  tableSection: {
    background: "#fff",
    borderRadius: 16,
    padding: "20px 24px",
    border: "1px solid var(--luc-border, #e2e5ea)",
    marginBottom: 28,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--luc-text, #1a1a2e)",
    marginBottom: 12,
  },
  legend: {
    display: "flex",
    gap: 16,
    marginBottom: 12,
    fontSize: 12,
    color: "#666",
  },
  legendItem: { display: "flex", alignItems: "center", gap: 5 },
  legendDot: { width: 12, height: 12, borderRadius: 3, display: "inline-block" },
  wishlistSection: {
    background: "#fff",
    borderRadius: 16,
    padding: "20px 24px",
    border: "1px solid var(--luc-border, #e2e5ea)",
    marginBottom: 28,
    boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
  },
  wishlistGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
    gap: 10,
  },
  wishlistCard: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #e3f2fd",
    background: "#f8fbff",
  },
  wishlistCardLink: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid #e3f2fd",
    background: "#f8fbff",
    textDecoration: "none",
    color: "inherit",
    transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
    cursor: "pointer",
  },
  elSymbol: {
    fontSize: 24,
    fontWeight: 800,
    color: "#4a90e2",
    width: 40,
    textAlign: "center",
  },
  elName: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--luc-text, #1a1a2e)",
    display: "block",
  },
  elNumber: {
    fontSize: 12,
    color: "var(--luc-text-muted, #6b7280)",
  },
  footer: {
    textAlign: "center",
    padding: "24px 0",
  },
  footerText: {
    fontSize: 13,
    color: "var(--luc-text-muted, #6b7280)",
  },
  footerLink: {
    fontSize: 14,
    color: "var(--luc-accent, #4A90E2)",
    fontWeight: 600,
    textDecoration: "none",
  },
};
