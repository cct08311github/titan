/**
 * Feature Flags — Issue #1328 (DB化), extended in #1516 (public read)
 *
 * Stores feature flags in PostgreSQL with 60s Redis cache TTL.
 * Falls back to in-memory cache when both DB and Redis are down.
 *
 * Supported flags:
 * - V2_DASHBOARD: Toggle new dashboard vs old
 * - V2_REPORTS: Toggle v2 reports
 * - ALERT_BANNER: Toggle global alert banner
 * - FEATURE_REACTIONS: Emoji reactions on comments + activity (#1512)
 *
 * Visibility:
 * - ALL_FLAGS — every known flag, exposed via the admin endpoint
 * - PUBLIC_FLAGS — subset readable by any authenticated user, exposed
 *   via /api/feature-flags/public for the useFeatureFlag client hook.
 *   Add a flag here only when its on/off state is safe to leak to all
 *   users (e.g. UI feature gates). Admin-only state (alert banners
 *   etc.) stays out of this list.
 */

import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";

const CACHE_KEY = "titan:feature-flags";
const CACHE_TTL = 60; // seconds

/** Default values when DB record does not exist yet */
const FLAG_DEFAULTS: Record<string, boolean> = {
  V2_DASHBOARD: false,
  V2_REPORTS: false,
  ALERT_BANNER: true,
  FEATURE_REACTIONS: false,
};

export type FeatureFlagName =
  | "V2_DASHBOARD"
  | "V2_REPORTS"
  | "ALERT_BANNER"
  | "FEATURE_REACTIONS";

/** All known flag names */
export const ALL_FLAGS: FeatureFlagName[] = [
  "V2_DASHBOARD",
  "V2_REPORTS",
  "ALERT_BANNER",
  "FEATURE_REACTIONS",
];

/** Subset of flags safe to expose to non-admin authenticated users. */
export const PUBLIC_FLAGS: FeatureFlagName[] = ["FEATURE_REACTIONS"];

/** In-memory fallback when both DB and Redis are down */
let memoryCache: Record<string, boolean> = {};
let memoryCacheAge = 0;

/**
 * Get a single feature flag value (server-side).
 * Lookup order: Redis → DB → in-memory fallback.
 */
export async function getFeatureFlag(name: FeatureFlagName): Promise<boolean> {
  const redis = getRedisClient();

  // 1. Try Redis cache
  if (redis) {
    try {
      const cached = await redis.hget(CACHE_KEY, name);
      if (cached !== null) return cached === "true";
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  // 2. DB lookup
  try {
    const flag = await prisma.featureFlag.findUnique({ where: { key: name } });
    const value = flag?.enabled ?? (FLAG_DEFAULTS[name] ?? false);

    // Update Redis cache
    if (redis) {
      try {
        await redis.hset(CACHE_KEY, name, String(value));
        await redis.expire(CACHE_KEY, CACHE_TTL);
      } catch {
        // Swallow Redis write errors
      }
    }

    memoryCache[name] = value;
    memoryCacheAge = Date.now();
    return value;
  } catch (err) {
    logger.warn({ err, name }, "[feature-flags] DB lookup failed — using in-memory fallback");
    // DB down — use memory cache if fresh enough
    if (Date.now() - memoryCacheAge < CACHE_TTL * 1000) {
      return memoryCache[name] ?? (FLAG_DEFAULTS[name] ?? false);
    }
    return FLAG_DEFAULTS[name] ?? false;
  }
}

/**
 * Set a feature flag value (ADMIN only — enforced at route layer).
 * Writes to DB and invalidates Redis cache entry.
 */
export async function setFeatureFlag(
  name: FeatureFlagName,
  enabled: boolean,
  updatedBy?: string,
): Promise<void> {
  await prisma.featureFlag.upsert({
    where: { key: name },
    create: { key: name, enabled, updatedBy },
    update: { enabled, updatedBy },
  });

  // Invalidate this flag's Redis cache entry
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.hdel(CACHE_KEY, name);
    } catch {
      // Swallow Redis errors
    }
  }

  memoryCache[name] = enabled;
  memoryCacheAge = Date.now();
}

/**
 * Get all feature flags (server-side).
 * Merges DB state with FLAG_DEFAULTS so every known flag is always returned.
 */
export async function getAllFeatureFlags(): Promise<Record<FeatureFlagName, boolean>> {
  const rows = await prisma.featureFlag.findMany();
  const result: Record<string, boolean> = {};
  for (const name of ALL_FLAGS) {
    result[name] = rows.find((f) => f.key === name)?.enabled ?? (FLAG_DEFAULTS[name] ?? false);
  }
  return result as Record<FeatureFlagName, boolean>;
}

/**
 * Returns only flags safe for non-admin clients.
 * Used by the public flag endpoint that backs the useFeatureFlag hook.
 */
export async function getPublicFeatureFlags(): Promise<Record<string, boolean>> {
  const rows = await prisma.featureFlag.findMany({
    where: { key: { in: PUBLIC_FLAGS } },
  });
  const result: Record<string, boolean> = {};
  for (const name of PUBLIC_FLAGS) {
    result[name] = rows.find((f) => f.key === name)?.enabled ?? (FLAG_DEFAULTS[name] ?? false);
  }
  return result;
}

/**
 * Check if a flag name is valid.
 */
export function isValidFlagName(name: string): name is FeatureFlagName {
  return ALL_FLAGS.includes(name as FeatureFlagName);
}
