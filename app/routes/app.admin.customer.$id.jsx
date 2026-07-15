/**
 * Admin Customer Profile View (Phase 2)
 * 
 * Enhanced with:
 * - Collection type display
 * - Periodic table integration
 * - Discount tracking in shipment history
 * - Grandfathering info
 * - Light theme
 */
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import ProgressBar from "../components/ProgressBar";
import PeriodicTable from "../components/PeriodicTable";

import * as db from "../data/mock-db.server";
import { getBillingSummary } from "../lib/billing.server.js";
import { ELEMENTS_118, isAvailableForCollection, isPreciousMetal } from "../data/elements.server";

export const loader = ({ params }) => {
  const customerId = params.id;
  const customer = db.getCustomerById(customerId);
  if (!customer) {
    throw new Response("Customer not found", { status: 404 });
  }

  const collectionType = customer.collectionType || "lucite";
  const stats = db.getCustomerStats(customerId);
  const collection = db.getCustomerCollection(customerId);
  const missing = db.getMissingProducts(customerId, collectionType);
  const wishlist = db.getWishlist(customerId);
  const subscription = db.getSubscription(customerId);
  const shipments = db.getShipments(customerId);
  const preferences = db.getPreferences(customerId);
  const notes = db.getAdminNotes(customerId);
  const ownedSymbolsSet = db.getOwnedElementSymbols(customerId);
  const ownedSymbols = Array.from(ownedSymbolsSet);
  const wishlistSymbols = wishlist.map(w => w.product.elementSymbol);

  // Serialize elements for periodic table
  const elements = ELEMENTS_118.map(e => ({
    z: e.z, sym: e.sym, name: e.name,
    row: e.row, col: e.col, group: e.group, phase: e.phase,
    available: isAvailableForCollection(e.z, collectionType),
    precious: isPreciousMetal(e.sym),
  }));

  let billingSummary = null;
  if (subscription) {
    billingSummary = getBillingSummary(subscription);
  }

  return json({
    customer, stats, collection, missing, wishlist,
    subscription, shipments, preferences, notes,
    collectionType, ownedSymbols, wishlistSymbols, billingSummary,
    elements,
  });
};

export default function AdminCustomerProfile() {
  const {
    customer, stats, collection, missing, wishlist,
    subscription, shipments, preferences, notes,
    collectionType, ownedSymbols, wishlistSymbols, billingSummary, elements,
  } = useLoaderData();

  return (
    <div>
        {/* Breadcrumb */}
        <div style={styles.breadcrumb}>
          <Link to="/app/admin/operations" style={styles.breadcrumbLink}>Operations</Link>
          <span style={styles.breadcrumbSep}>›</span>
          <span>{customer.firstName} {customer.lastName}</span>
        </div>

        {/* Customer Header */}
        <div style={styles.profileHeader}>
          <div>
            <h2 style={styles.profileName}>{customer.firstName} {customer.lastName}</h2>
            <div style={styles.profileMeta}>
              <span style={styles.displayBadge}>{customer.displayName}</span>
              <span style={styles.ctBadge}>{collectionType}</span>
              <span>{customer.email}</span>
              {subscription && (
                <span style={{
                  ...styles.subStatus,
                  color: subscription.status === "active" ? "var(--luc-success)" : "var(--luc-warning)",
                }}>
                  {subscription.planName} — {subscription.status}
                </span>
              )}
            </div>
          </div>
          <div style={styles.headerActions}>
            <button style={styles.headerBtn}>📧 Email Customer</button>
            <button style={styles.headerBtn}>📝 Add Note</button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={styles.statsRow}>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{stats.totalCollected}</div>
            <div style={styles.statLabel}>Collected</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statValue, color: "var(--luc-warning)" }}>{stats.missingCount}</div>
            <div style={styles.statLabel}>Missing</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{stats.wishlistCount}</div>
            <div style={styles.statLabel}>Wishlist</div>
          </div>
          <div style={styles.statBox}>
            <div style={{ ...styles.statValue, color: "var(--luc-accent)" }}>{stats.completionPct}%</div>
            <div style={styles.statLabel}>Completion</div>
          </div>
          <div style={styles.statBox}>
            <div style={styles.statValue}>{stats.totalShipments}</div>
            <div style={styles.statLabel}>Shipments</div>
          </div>
        </div>

        <ProgressBar
          value={stats.totalCollected}
          max={118}
          label="Collection Completion"
          accent={stats.totalCollected >= 118 ? "var(--luc-gold)" : "var(--luc-accent)"}
        />

        {/* Periodic Table */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Collection Status — Periodic Table</h3>
          <div style={styles.tableWrapper}>
            <PeriodicTable
              elements={elements}
              ownedSymbols={ownedSymbols}
              wishlistedSymbols={wishlistSymbols}
              collectionType={collectionType}
              compact={true}
            />
          </div>
        </div>

        {/* Subscription Info with Grandfathering */}
        {subscription && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Subscription Details</h3>
            <div style={styles.detailGrid}>
              <Detail label="Plan" value={subscription.planName} />
              <Detail label="Tier" value={subscription.planTier} />
              <Detail label="Status" value={subscription.status} />
              <Detail label="Collection" value={collectionType} />
              <Detail label="Price" value={`$${subscription.priceUsd}/mo`} />
              <Detail label="Cadence" value={subscription.billingCadence} />
              <Detail label="Next Shipment" value={formatDate(subscription.nextShipmentDate)} />
              <Detail label="Member Since" value={formatDate(subscription.startDate)} />
            </div>
            {billingSummary?.grandfather?.isGrandfathered && (
              <div style={styles.grandfatherInfo}>
                🔒 <strong>Grandfathered</strong>: ${billingSummary.grandfather.originalPrice}/mo locked until {billingSummary.grandfather.expiresAt}
                {billingSummary.grandfather.monthlySavings > 0 && (
                  <> (saving ${billingSummary.grandfather.monthlySavings.toFixed(2)}/mo)</>
                )}
              </div>
            )}
          </div>
        )}

        {/* Preferences */}
        {preferences && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Preferences</h3>
            <div style={styles.detailGrid}>
              <Detail label="Duplicate Handling" value={preferences.duplicateHandling} />
              <Detail label="Categories" value={(preferences.preferredCategories || []).join(", ") || "Any"} />
              <Detail label="Formats" value={(preferences.preferredFormats || []).join(", ") || "Any"} />
              <Detail label="Budget Max" value={preferences.budgetMaxUsd ? `$${preferences.budgetMaxUsd}` : "No limit"} />
              <Detail label="Email" value={preferences.communicationEmail ? "✓" : "✗"} />
              <Detail label="Restock Alerts" value={preferences.restockAlerts ? "✓" : "✗"} />
            </div>
          </div>
        )}

        {/* Shipment History with Discount */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Shipment History</h3>
          {shipments.length === 0 ? (
            <p style={styles.emptyText}>No shipments yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Items</th>
                  <th style={styles.th}>Discount</th>
                  <th style={styles.th}>Tracking</th>
                </tr>
              </thead>
              <tbody>
                {shipments.map((s) => (
                  <tr key={s.id}>
                    <td style={styles.td}>{formatDate(s.date)}</td>
                    <td style={styles.td}>
                      <span style={{
                        color: s.status === "delivered" ? "var(--luc-success)" :
                               s.status === "shipped" ? "var(--luc-accent)" : "var(--luc-text-muted)",
                      }}>
                        {s.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      {s.itemProducts.map((p) => (
                        <span key={p.id} style={styles.itemTag}>
                          {p.elementSymbol} — {p.title}
                        </span>
                      ))}
                      {s.itemProducts.length === 0 && <span style={{ color: "var(--luc-text-muted)" }}>—</span>}
                    </td>
                    <td style={styles.td}>
                      {s.discountPercent != null && s.discountPercent > 0 ? (
                        <span style={{
                          fontWeight: 700,
                          color: s.discountPercent > 20 ? "var(--luc-danger)" : "var(--luc-success)",
                        }}>
                          {s.discountPercent.toFixed(1)}%
                          {s.discountPercent > 20 && " ⚠️"}
                        </span>
                      ) : (
                        <span style={{ color: "var(--luc-text-muted)" }}>—</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 11 }}>{s.tracking || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Wishlist */}
        {wishlist.length > 0 && (
          <div style={styles.section}>
            <h3 style={styles.sectionTitle}>Wishlist ({wishlist.length})</h3>
            <div style={styles.wishlistGrid}>
              {wishlist.map((w) => (
                <div key={w.product.id} style={styles.wishlistCard}>
                  <span style={styles.wishPriority}>#{w.priority}</span>
                  <span style={styles.wishSymbol}>{w.product.elementSymbol}</span>
                  <span style={styles.wishTitle}>{w.product.title}</span>
                  <span style={styles.wishStock}>
                    {w.product.inventoryQty > 0
                      ? <span style={{ color: "var(--luc-success)" }}>{w.product.inventoryQty} in stock</span>
                      : <span style={{ color: "var(--luc-danger)" }}>Out of stock</span>}
                  </span>
                  {w.notifyOnRestock && <span style={styles.notifyIcon}>🔔</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Admin Notes */}
        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Admin Notes</h3>
          {notes.length === 0 ? (
            <p style={styles.emptyText}>No notes yet.</p>
          ) : (
            <div style={styles.notesList}>
              {notes.map((n, i) => (
                <div key={i} style={styles.noteCard}>
                  <div style={styles.noteHeader}>
                    <span style={styles.noteAuthor}>{n.author}</span>
                    <span style={styles.noteDate}>{n.date}</span>
                  </div>
                  <p style={styles.noteContent}>{n.content}</p>
                </div>
              ))}
            </div>
          )}
          <div style={styles.addNoteRow}>
            <input placeholder="Add a note..." style={styles.noteInput} />
            <button style={styles.addNoteBtn}>Add Note</button>
          </div>
        </div>
      
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div style={styles.detailItem}>
      <span style={styles.detailLabel}>{label}</span>
      <span style={styles.detailValue}>{value}</span>
    </div>
  );
}

function formatDate(str) {
  return new Date(str).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const styles = {
  breadcrumb: { display: "flex", alignItems: "center", gap: 8, marginBottom: 16, fontSize: 13 },
  breadcrumbLink: { color: "var(--luc-accent)", textDecoration: "none" },
  breadcrumbSep: { color: "var(--luc-text-muted)" },
  profileHeader: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 },
  profileName: { fontSize: 24, fontWeight: 700, color: "var(--luc-text)", margin: 0 },
  profileMeta: { display: "flex", alignItems: "center", gap: 12, marginTop: 6, fontSize: 13, color: "var(--luc-text-muted)", flexWrap: "wrap" },
  displayBadge: { padding: "2px 8px", background: "#EBF3FC", borderRadius: 6, color: "var(--luc-accent)", fontWeight: 600 },
  ctBadge: { padding: "2px 8px", background: "#f0fdf4", borderRadius: 6, color: "var(--luc-success)", fontWeight: 600, fontSize: 11, textTransform: "capitalize" },
  subStatus: { fontWeight: 600 },
  headerActions: { display: "flex", gap: 8 },
  headerBtn: {
    padding: "6px 14px", borderRadius: 8, border: "1px solid var(--luc-border)",
    background: "transparent", color: "var(--luc-text)", fontSize: 12, cursor: "pointer",
  },
  statsRow: { display: "flex", gap: 16, marginBottom: 20, flexWrap: "wrap" },
  statBox: { textAlign: "center", minWidth: 80 },
  statValue: { fontSize: 28, fontWeight: 800, color: "var(--luc-text)" },
  statLabel: { fontSize: 11, color: "var(--luc-text-muted)", textTransform: "uppercase", fontWeight: 600 },
  section: { marginTop: 32 },
  sectionTitle: {
    fontSize: 16, fontWeight: 700, color: "var(--luc-text)", marginBottom: 16,
    paddingBottom: 8, borderBottom: "1px solid var(--luc-border)",
  },
  tableWrapper: {
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 12,
    padding: "16px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  grandfatherInfo: {
    marginTop: 12, padding: 10, background: "#f0fdf4", border: "1px solid #bbf7d0",
    borderRadius: 8, fontSize: 12, color: "#15803d",
  },
  detailGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12 },
  detailItem: { display: "flex", flexDirection: "column", gap: 2 },
  detailLabel: { fontSize: 11, color: "var(--luc-text-muted)", textTransform: "uppercase", fontWeight: 600 },
  detailValue: { fontSize: 14, fontWeight: 500, color: "var(--luc-text)" },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "left", padding: "8px 12px", fontSize: 11, color: "var(--luc-text-muted)", textTransform: "uppercase", fontWeight: 600, borderBottom: "1px solid var(--luc-border)" },
  td: { padding: "10px 12px", fontSize: 13, color: "var(--luc-text)", borderBottom: "1px solid var(--luc-border)" },
  itemTag: { display: "block", fontSize: 13 },
  wishlistGrid: { display: "flex", flexDirection: "column", gap: 8 },
  wishlistCard: {
    display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
    background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 8,
  },
  wishPriority: { fontSize: 12, fontWeight: 700, color: "var(--luc-accent)", minWidth: 24 },
  wishSymbol: { fontSize: 18, fontWeight: 800, color: "var(--luc-accent)", minWidth: 32 },
  wishTitle: { fontSize: 13, color: "var(--luc-text)", flex: 1 },
  wishStock: { fontSize: 12 },
  notifyIcon: { fontSize: 12 },
  notesList: { display: "flex", flexDirection: "column", gap: 8 },
  noteCard: {
    padding: 14, background: "#ffffff", border: "1px solid var(--luc-border)", borderRadius: 8,
  },
  noteHeader: { display: "flex", justifyContent: "space-between", marginBottom: 6 },
  noteAuthor: { fontSize: 13, fontWeight: 600, color: "var(--luc-accent)" },
  noteDate: { fontSize: 11, color: "var(--luc-text-muted)" },
  noteContent: { fontSize: 13, color: "var(--luc-text)", margin: 0, lineHeight: 1.5 },
  addNoteRow: { display: "flex", gap: 8, marginTop: 12 },
  noteInput: {
    flex: 1, padding: "8px 12px", background: "#ffffff",
    border: "1px solid var(--luc-border)", borderRadius: 8,
    color: "var(--luc-text)", fontSize: 13, outline: "none",
  },
  addNoteBtn: {
    padding: "8px 16px", background: "var(--luc-accent)", color: "#fff",
    border: "none", borderRadius: 8, fontSize: 13, fontWeight: 600, cursor: "pointer",
  },
  emptyText: { fontSize: 13, color: "var(--luc-text-muted)", fontStyle: "italic" },
};
