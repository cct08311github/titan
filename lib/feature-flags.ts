/**
 * Feature Flags — Issue #988
 *
 * Simple env-var based feature flag system.
 * Flags are read from process.env with prefix TITAN_FF_.
 *
 * Supported flags:
 * - V2_DASHBOARD: Toggle new dashboard vs old
 * - V2_REPORTS: Toggle v2 reports
 * - ALERT_BANNER: Toggle global alert banner
 */

export type FeatureFlagName = "V2_DASHBOARD" | "V2_REPORTS" | "ALERT_BANNER";

/** Default values when env var is not set */
const FLAG_DEFAULTS: Record<FeatureFlagName, boolean> = {
  V2_DASHBOARD: false,
  V2_REPORTS: false,
  ALERT_BANNER: true,
};

/** All known flag names */
export const ALL_FLAGS: FeatureFlagName[] = ["V2_DASHBOARD", "V2_REPORTS", "ALERT_BANNER"];

/**
 * Get a feature flag value (server-side).
 * Reads from `process.env.TITAN_FF_<NAME>`.
 * Values: "true"/"1" = enabled, anything else = disabled.
 */
export function getFeatureFlag(name: FeatureFlagName): boolean {
  const envKey = `TITAN_FF_${name}`;
  const envVal = process.env[envKey];

  if (envVal === undefined || envVal === "") {
    return FLAG_DEFAULTS[name] ?? false;
  }

  return envVal === "true" || envVal === "1";
}

/**
 * Get all feature flags (server-side).
 */
export function getAllFeatureFlags(): Record<FeatureFlagName, boolean> {
  const flags: Record<string, boolean> = {};
  for (const name of ALL_FLAGS) {
    flags[name] = getFeatureFlag(name);
  }
  return flags as Record<FeatureFlagName, boolean>;
}

/**
 * Check if a flag name is valid.
 */
export function isValidFlagName(name: string): name is FeatureFlagName {
  return ALL_FLAGS.includes(name as FeatureFlagName);
}
