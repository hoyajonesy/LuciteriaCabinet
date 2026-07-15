/**
 * Feature Flag System
 * 
 * Admin-controllable flags for phased feature rollout.
 * Phase 2 features are built but dormant behind flags.
 * Phase 3 is scaffold-only (always false).
 */
import { prisma } from "./db.server.js";

/**
 * Get a single feature flag value
 */
export async function getFeatureFlag(flagName) {
  const flag = await prisma.featureFlag.findUnique({
    where: { flagName },
  });
  return flag?.isEnabled ?? false;
}

/**
 * Get all feature flags as a key-value map
 */
export async function getAllFeatureFlags() {
  const flags = await prisma.featureFlag.findMany();
  const map = {};
  for (const f of flags) {
    map[f.flagName] = f.isEnabled;
  }
  return map;
}

/**
 * Set a feature flag value
 */
export async function setFeatureFlag(flagName, isEnabled) {
  return prisma.featureFlag.upsert({
    where: { flagName },
    update: { isEnabled },
    create: { flagName, isEnabled, description: `Auto-created flag: ${flagName}` },
  });
}

/**
 * Check if a Phase 2 feature is enabled
 */
export async function isPhase2Enabled(feature) {
  return await getFeatureFlag(`phase2_${feature}`);
}

/**
 * Check if Phase 3 is enabled (always false for now)
 */
export async function isPhase3Enabled() {
  return await getFeatureFlag("phase3_enabled"); // Always false
}

/**
 * Seed initial feature flags (called from seed script)
 */
export async function seedFeatureFlags() {
  const flags = [
    { flagName: "phase2_ownership_tracking", isEnabled: false, description: "Track user SKU ownership" },
    { flagName: "phase2_completion_display", isEnabled: false, description: "Show completion progress UI" },
    { flagName: "phase2_suggestions", isEnabled: false, description: "Display missing element suggestions" },
    { flagName: "phase3_enabled", isEnabled: false, description: "Dynamic curation system (always false)" },
  ];

  for (const flag of flags) {
    await prisma.featureFlag.upsert({
      where: { flagName: flag.flagName },
      update: {},
      create: flag,
    });
  }
}
