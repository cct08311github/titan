/**
 * SystemSettingService — Issue #1313
 *
 * Key/value store backed by the system_settings table.
 * Provides 5-minute in-memory cache to avoid repeated DB hits for frequently
 * read settings (e.g. stale-task thresholds read by every cron run).
 *
 * Design notes:
 * - Cache is intentionally module-level (singleton) so it persists across requests
 *   in the same Node.js process instance.
 * - setSetting() clears the cache entry immediately so reads reflect new values.
 * - get/set are kept generic (via Json column) so any JSON-serializable value works.
 */

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

// Module-level cache (in-memory, per process)
const settingCache = new Map<string, CacheEntry<unknown>>();

type Deps = {
  prisma: PrismaClient;
};

/**
 * Retrieve a typed setting by key.
 * Returns the cached value if fresh, otherwise queries the DB.
 * Falls back to `fallback` if the key doesn't exist in the DB.
 */
export async function getSetting<T>(
  key: string,
  fallback: T,
  deps?: Partial<Deps>
): Promise<T> {
  const now = Date.now();
  const cached = settingCache.get(key);

  if (cached && cached.expiresAt > now) {
    return cached.value as T;
  }

  const db = deps?.prisma ?? defaultPrisma;
  const row = await db.systemSetting.findUnique({ where: { key } });

  if (row === null) {
    return fallback;
  }

  const parsed = row.value as T;
  settingCache.set(key, { value: parsed, expiresAt: now + CACHE_TTL_MS });
  return parsed;
}

/**
 * Persist a setting value and invalidate the cache for that key.
 */
export async function setSetting(
  key: string,
  value: unknown,
  updatedBy?: string | null,
  deps?: Partial<Deps>
): Promise<void> {
  const db = deps?.prisma ?? defaultPrisma;

  await db.systemSetting.upsert({
    where: { key },
    create: {
      key,
      value: value as never,
      updatedBy: updatedBy ?? null,
    },
    update: {
      value: value as never,
      updatedBy: updatedBy ?? null,
    },
  });

  // Invalidate cache so next getSetting() reads from DB
  settingCache.delete(key);
}

/**
 * Delete a cache entry (useful in tests).
 */
export function clearSettingCache(key?: string): void {
  if (key) {
    settingCache.delete(key);
  } else {
    settingCache.clear();
  }
}
