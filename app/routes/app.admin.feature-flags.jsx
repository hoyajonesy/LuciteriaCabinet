/**
 * Admin: Feature Flags
 * Toggle switches for Phase 2/3 features.
 */
import { json } from "@remix-run/node";
import { useLoaderData, useFetcher } from "@remix-run/react";
import { prisma } from "../lib/db.server.js";
import AppNav from "../components/AppNav.jsx";
import PhaseToggle from "../components/PhaseToggle.jsx";

const FLAG_META = {
  phase2_ownership_tracking: { label: "Phase 2: Ownership Tracking", phase: 2 },
  phase2_completion_display: { label: "Phase 2: Completion Progress UI", phase: 2 },
  phase2_suggestions: { label: "Phase 2: Missing Element Suggestions", phase: 2 },
  phase3_enabled: { label: "Phase 3: Dynamic Curation", phase: 3 },
};

export async function loader() {
  const flags = await prisma.featureFlag.findMany({ orderBy: { flagName: "asc" } });
  return json({ flags });
}

export async function action({ request }) {
  const form = await request.formData();
  const flagName = form.get("flagName");
  const isEnabled = form.get("isEnabled") === "true";

  // Phase 3 safety: never allow enabling phase3
  if (flagName === "phase3_enabled" && isEnabled) {
    return json({ error: "Phase 3 cannot be enabled yet — scaffold only." }, { status: 400 });
  }

  await prisma.featureFlag.upsert({
    where: { flagName },
    update: { isEnabled },
    create: { flagName, isEnabled, description: FLAG_META[flagName]?.label || flagName },
  });

  return json({ success: `${flagName} → ${isEnabled ? "enabled" : "disabled"}` });
}

export default function AdminFeatureFlags() {
  const { flags } = useLoaderData();
  const fetcher = useFetcher();

  const flagMap = {};
  for (const f of flags) flagMap[f.flagName] = f;

  const handleToggle = (flagName, newValue) => {
    fetcher.submit(
      { flagName, isEnabled: String(newValue) },
      { method: "post" }
    );
  };

  const phase2Flags = flags.filter(f => f.flagName.startsWith("phase2_"));
  const phase3Flags = flags.filter(f => f.flagName.startsWith("phase3_"));

  return (
    <div style={styles.layout}>
      <AppNav mode="admin" />
      <main style={styles.main}>
        <h2 style={styles.title}>Feature Flags</h2>
        <p style={styles.subtitle}>Control phased feature rollout. Phase 2 features are built but dormant by default.</p>

        {fetcher.data?.error && <div style={styles.error}>{fetcher.data.error}</div>}
        {fetcher.data?.success && <div style={styles.success}>{fetcher.data.success}</div>}

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Phase 2 — Ownership & Suggestions</h3>
            <span style={styles.phaseBadge}>Built, Dormant</span>
          </div>
          <p style={styles.sectionDesc}>
            These features track per-user SKU ownership, show completion progress, and suggest missing elements.
            Enable when ready to roll out to subscribers.
          </p>
          <div style={styles.flagList}>
            {phase2Flags.map(f => (
              <PhaseToggle
                key={f.flagName}
                flagName={f.flagName}
                label={FLAG_META[f.flagName]?.label || f.flagName}
                description={f.description}
                isEnabled={f.isEnabled}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>Phase 3 — Dynamic Curation</h3>
            <span style={{ ...styles.phaseBadge, backgroundColor: "#FEF3C7", color: "#92400E" }}>Scaffold Only</span>
          </div>
          <p style={styles.sectionDesc}>
            Phase 3 curation system is scaffolded but NOT functional. Stubs exist for future implementation.
            This flag cannot be enabled at this time.
          </p>
          <div style={styles.flagList}>
            {phase3Flags.map(f => (
              <PhaseToggle
                key={f.flagName}
                flagName={f.flagName}
                label={FLAG_META[f.flagName]?.label || f.flagName}
                description={f.description}
                isEnabled={f.isEnabled}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </section>

        <section style={styles.infoBox}>
          <h4 style={{ margin: "0 0 8px" }}>🔧 How Feature Flags Work</h4>
          <ul style={{ margin: 0, paddingLeft: "20px", fontSize: "13px", color: "#374151", lineHeight: 1.8 }}>
            <li><strong>phase2_ownership_tracking</strong> — Enables creating UserOwnedSku records when purchases occur</li>
            <li><strong>phase2_completion_display</strong> — Shows collection completion rings on the dashboard</li>
            <li><strong>phase2_suggestions</strong> — Displays "You're missing these" element suggestions</li>
            <li><strong>phase3_enabled</strong> — Dynamic curation system (always disabled for now)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}

const styles = {
  layout: { display: "flex", minHeight: "100vh", backgroundColor: "#F9FAFB" },
  main: { flex: 1, padding: "32px", maxWidth: "800px" },
  title: { margin: 0, fontSize: "24px", fontWeight: 700 },
  subtitle: { margin: "4px 0 24px", fontSize: "14px", color: "#6B7280" },
  error: { padding: "12px", backgroundColor: "#FEF2F2", color: "#DC2626", borderRadius: "8px", marginBottom: "16px" },
  success: { padding: "12px", backgroundColor: "#F0FDF4", color: "#065F46", borderRadius: "8px", marginBottom: "16px" },
  section: { marginBottom: "32px" },
  sectionHeader: { display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" },
  sectionTitle: { margin: 0, fontSize: "18px", fontWeight: 700 },
  phaseBadge: { fontSize: "11px", padding: "2px 10px", backgroundColor: "#EEF2FF", color: "#4338CA", borderRadius: "4px", fontWeight: 600 },
  sectionDesc: { fontSize: "13px", color: "#6B7280", margin: "0 0 16px", lineHeight: 1.5 },
  flagList: { display: "flex", flexDirection: "column", gap: "8px" },
  infoBox: { padding: "20px", backgroundColor: "#F0F9FF", borderRadius: "12px", border: "1px solid #BAE6FD" },
};
