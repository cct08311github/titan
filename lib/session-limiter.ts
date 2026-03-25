/**
 * Concurrent session limiter — Issue #184, #387
 *
 * Enforces a maximum number of concurrent sessions per user (default: 2).
 * When a user logs in and the limit is exceeded, the oldest session is
 * invalidated via the JWT blacklist.
 *
 * Uses Redis when available, falls back to in-memory store.
 *
 * Redis storage: sorted set per user, score = timestamp, member = sessionId.
 * In-memory storage: Map<userId, Array<{ sessionId, createdAt }>>.
 */

import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { JwtBlacklist } from "@/lib/jwt-blacklist";

const REDIS_PREFIX = "titan:sessions:";
const SESSION_TTL = 8 * 60 * 60; // 8 hours (matches JWT maxAge)

/** Maximum concurrent sessions per user — configurable via env */
const MAX_CONCURRENT_SESSIONS = parseInt(
  process.env.MAX_CONCURRENT_SESSIONS ?? "2",
  10
);

/** In-memory fallback: userId → list of { sessionId, createdAt } */
const memStore = new Map<string, Array<{ sessionId: string; createdAt: number }>>();

/**
 * Register a new session for a user.
 * If the user already has MAX_CONCURRENT_SESSIONS, the oldest is invalidated.
 */
export async function registerSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const now = Date.now();
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = `${REDIS_PREFIX}${userId}`;

      // Add the new session with current timestamp as score
      await redis.zadd(key, now, sessionId);
      await redis.expire(key, SESSION_TTL);

      // Check if we exceed the limit
      const count = await redis.zcard(key);
      if (count > MAX_CONCURRENT_SESSIONS) {
        // Get the oldest sessions that exceed the limit
        const excess = count - MAX_CONCURRENT_SESSIONS;
        const oldSessions = await redis.zrange(key, 0, excess - 1);

        // Remove them from the sorted set
        if (oldSessions.length > 0) {
          await redis.zrem(key, ...oldSessions);

          // Blacklist each evicted session
          for (const oldId of oldSessions) {
            JwtBlacklist.add(`session:${oldId}`);
          }

          logger.info(
            { userId, evictedCount: oldSessions.length, maxAllowed: MAX_CONCURRENT_SESSIONS },
            "[session-limiter] Oldest session(s) invalidated — concurrent limit exceeded"
          );
        }
      }
      return;
    } catch (err) {
      logger.error({ err }, "[session-limiter] Redis error, using memory fallback");
      // Fall through to memory store
    }
  }

  // In-memory fallback
  let sessions = memStore.get(userId);
  if (!sessions) {
    sessions = [];
    memStore.set(userId, sessions);
  }

  sessions.push({ sessionId, createdAt: now });

  // Evict oldest if over limit
  if (sessions.length > MAX_CONCURRENT_SESSIONS) {
    // Sort ascending by createdAt
    sessions.sort((a, b) => a.createdAt - b.createdAt);

    const excess = sessions.length - MAX_CONCURRENT_SESSIONS;
    const evicted = sessions.splice(0, excess);

    for (const old of evicted) {
      JwtBlacklist.add(`session:${old.sessionId}`);
    }

    logger.info(
      { userId, evictedCount: evicted.length, maxAllowed: MAX_CONCURRENT_SESSIONS },
      "[session-limiter] Oldest session(s) invalidated — concurrent limit exceeded"
    );
  }
}

/**
 * Remove stale session entries from the Redis sorted set.
 * Members with score (timestamp) older than SESSION_TTL are expired sessions
 * that were never explicitly cleared (e.g., browser closed without logout).
 */
async function pruneStaleMembers(redis: NonNullable<ReturnType<typeof getRedisClient>>, key: string): Promise<void> {
  const cutoff = Date.now() - SESSION_TTL * 1000;
  await redis.zremrangebyscore(key, 0, cutoff);
}

/**
 * Check if a session is still active for its user.
 */
export async function isSessionActive(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = `${REDIS_PREFIX}${userId}`;

      // Prune stale members before checking
      await pruneStaleMembers(redis, key);

      // Refresh key TTL on active check
      await redis.expire(key, SESSION_TTL);

      // zscore returns null if member doesn't exist
      const score = await redis.zscore(key, sessionId);
      return score !== null;
    } catch {
      // fallback
    }
  }

  // In-memory fallback: also prune stale entries
  const sessions = memStore.get(userId);
  if (!sessions) return false;
  const cutoff = Date.now() - SESSION_TTL * 1000;
  const active = sessions.filter((s) => s.createdAt > cutoff);
  if (active.length !== sessions.length) {
    memStore.set(userId, active);
  }
  return active.some((s) => s.sessionId === sessionId);
}

/**
 * Clear a specific session for a user (on logout).
 */
export async function clearSession(
  userId: string,
  sessionId?: string
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      if (sessionId) {
        await redis.zrem(`${REDIS_PREFIX}${userId}`, sessionId);
      } else {
        await redis.del(`${REDIS_PREFIX}${userId}`);
      }
      return;
    } catch {
      // fallback
    }
  }

  if (sessionId) {
    const sessions = memStore.get(userId);
    if (sessions) {
      const idx = sessions.findIndex((s) => s.sessionId === sessionId);
      if (idx >= 0) sessions.splice(idx, 1);
      if (sessions.length === 0) memStore.delete(userId);
    }
  } else {
    memStore.delete(userId);
  }
}

/**
 * Get the count of active sessions for a user.
 * Prunes stale entries before counting.
 */
export async function getActiveSessionCount(userId: string): Promise<number> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = `${REDIS_PREFIX}${userId}`;
      await pruneStaleMembers(redis, key);
      return await redis.zcard(key);
    } catch {
      // fallback
    }
  }

  // In-memory fallback: prune stale entries
  const sessions = memStore.get(userId);
  if (!sessions) return 0;
  const cutoff = Date.now() - SESSION_TTL * 1000;
  const active = sessions.filter((s) => s.createdAt > cutoff);
  if (active.length !== sessions.length) {
    memStore.set(userId, active);
  }
  return active.length;
}

/** Exported for testing — allows overriding the max concurrent sessions */
export const _config = {
  get maxConcurrentSessions() {
    return MAX_CONCURRENT_SESSIONS;
  },
};
