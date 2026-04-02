/**
 * Concurrent session limiter — Issue #184, #387, #1086
 *
 * Enforces a maximum number of concurrent sessions per user per platform.
 * When a user logs in and the limit is exceeded, the oldest session is
 * invalidated via the JWT blacklist.
 *
 * Uses Redis when available, falls back to in-memory store.
 *
 * Redis storage: sorted set per user+platform, score = timestamp, member = sessionId.
 *   - Lua script for atomic ZADD + EXPIRE + ZCARD + evict flow.
 * In-memory storage: Map<userId:platform, Array<{ sessionId, createdAt }>>.
 *
 * Issue #1086: Platform separation — web and mobile have independent limits.
 */

import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { JwtBlacklist } from "@/lib/jwt-blacklist";

/** Supported session platforms */
export type SessionPlatform = "web" | "mobile";

const REDIS_PREFIX = "titan:sessions:";
const SESSION_TTL = 8 * 60 * 60; // 8 hours (matches JWT maxAge)

/** Maximum concurrent sessions per user per platform — configurable via env */
const WEB_MAX_SESSIONS = parseInt(
  process.env.WEB_MAX_SESSIONS ?? process.env.MAX_CONCURRENT_SESSIONS ?? "2",
  10
);
const MOBILE_MAX_SESSIONS = parseInt(
  process.env.MOBILE_MAX_SESSIONS ?? "2",
  10
);

/** Resolve the max sessions limit for a given platform */
function getMaxSessions(platform: SessionPlatform): number {
  return platform === "mobile" ? MOBILE_MAX_SESSIONS : WEB_MAX_SESSIONS;
}

/** Build the Redis key for a user + platform combination */
function redisKey(userId: string, platform: SessionPlatform): string {
  return `${REDIS_PREFIX}${userId}:${platform}`;
}

/** Build the in-memory store key for a user + platform combination */
function memKey(userId: string, platform: SessionPlatform): string {
  return `${userId}:${platform}`;
}

/** In-memory fallback: userId:platform -> list of { sessionId, createdAt } */
const memStore = new Map<string, Array<{ sessionId: string; createdAt: number }>>();

/**
 * Lua script for atomic session registration in Redis.
 *
 * KEYS[1] = sorted set key
 * ARGV[1] = sessionId
 * ARGV[2] = current timestamp (score)
 * ARGV[3] = maxSessions
 * ARGV[4] = TTL in seconds
 *
 * Returns: array of evicted session IDs (empty if none evicted)
 *
 * Note: redis.eval() is the standard Redis Lua scripting API (server-side
 * execution), not JavaScript eval(). The Lua script runs atomically on
 * the Redis server.
 */
const REGISTER_SESSION_LUA = `
local key = KEYS[1]
local sessionId = ARGV[1]
local now = ARGV[2]
local maxSessions = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

redis.call('ZADD', key, now, sessionId)
redis.call('EXPIRE', key, ttl)
local count = redis.call('ZCARD', key)
if count > maxSessions then
  local toRemove = redis.call('ZRANGE', key, 0, count - maxSessions - 1)
  for _, sid in ipairs(toRemove) do
    redis.call('ZREM', key, sid)
  end
  return toRemove
end
return {}
`;

/**
 * Register a new session for a user on a given platform.
 * If the user already has the max allowed sessions for that platform,
 * the oldest is invalidated.
 *
 * @param platform - defaults to 'web' for backwards compatibility
 */
export async function registerSession(
  userId: string,
  sessionId: string,
  platform: SessionPlatform = "web"
): Promise<void> {
  const now = Date.now();
  const maxSessions = getMaxSessions(platform);
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = redisKey(userId, platform);

      // Atomic Lua: ZADD + EXPIRE + ZCARD + evict oldest if over limit
      // Uses redis.eval() — the standard Redis Lua scripting API for
      // server-side atomic execution (not JavaScript eval).
      const evicted = (await redis.eval(
        REGISTER_SESSION_LUA,
        1,
        key,
        sessionId,
        String(now),
        String(maxSessions),
        String(SESSION_TTL)
      )) as string[];

      if (evicted && evicted.length > 0) {
        for (const oldId of evicted) {
          JwtBlacklist.add(`session:${oldId}`);
        }

        logger.info(
          { userId, platform, evictedCount: evicted.length, maxAllowed: maxSessions },
          "[session-limiter] Oldest session(s) invalidated — concurrent limit exceeded"
        );
      }
      return;
    } catch (err) {
      logger.error({ err }, "[session-limiter] Redis error, using memory fallback");
      // Fall through to memory store
    }
  }

  // In-memory fallback
  const mk = memKey(userId, platform);
  let sessions = memStore.get(mk);
  if (!sessions) {
    sessions = [];
    memStore.set(mk, sessions);
  }

  sessions.push({ sessionId, createdAt: now });

  // Evict oldest if over limit
  if (sessions.length > maxSessions) {
    // Sort ascending by createdAt
    sessions.sort((a, b) => a.createdAt - b.createdAt);

    const excess = sessions.length - maxSessions;
    const evicted = sessions.splice(0, excess);

    for (const old of evicted) {
      JwtBlacklist.add(`session:${old.sessionId}`);
    }

    logger.info(
      { userId, platform, evictedCount: evicted.length, maxAllowed: maxSessions },
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
 * Check if a session is still active for its user on a given platform.
 *
 * @param platform - defaults to 'web' for backwards compatibility
 */
export async function isSessionActive(
  userId: string,
  sessionId: string,
  platform: SessionPlatform = "web"
): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = redisKey(userId, platform);

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
  const mk = memKey(userId, platform);
  const sessions = memStore.get(mk);
  if (!sessions) return false;
  const cutoff = Date.now() - SESSION_TTL * 1000;
  const active = sessions.filter((s) => s.createdAt > cutoff);
  if (active.length !== sessions.length) {
    memStore.set(mk, active);
  }
  return active.some((s) => s.sessionId === sessionId);
}

/**
 * Clear a specific session for a user (on logout).
 *
 * @param platform - defaults to 'web' for backwards compatibility
 */
export async function clearSession(
  userId: string,
  sessionId?: string,
  platform: SessionPlatform = "web"
): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = redisKey(userId, platform);
      if (sessionId) {
        await redis.zrem(key, sessionId);
      } else {
        await redis.del(key);
      }
      return;
    } catch {
      // fallback
    }
  }

  const mk = memKey(userId, platform);
  if (sessionId) {
    const sessions = memStore.get(mk);
    if (sessions) {
      const idx = sessions.findIndex((s) => s.sessionId === sessionId);
      if (idx >= 0) sessions.splice(idx, 1);
      if (sessions.length === 0) memStore.delete(mk);
    }
  } else {
    memStore.delete(mk);
  }
}

/**
 * Get the count of active sessions for a user on a given platform.
 * Prunes stale entries before counting.
 *
 * @param platform - defaults to 'web' for backwards compatibility
 */
export async function getActiveSessionCount(
  userId: string,
  platform: SessionPlatform = "web"
): Promise<number> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const key = redisKey(userId, platform);
      await pruneStaleMembers(redis, key);
      return await redis.zcard(key);
    } catch {
      // fallback
    }
  }

  // In-memory fallback: prune stale entries
  const mk = memKey(userId, platform);
  const sessions = memStore.get(mk);
  if (!sessions) return 0;
  const cutoff = Date.now() - SESSION_TTL * 1000;
  const active = sessions.filter((s) => s.createdAt > cutoff);
  if (active.length !== sessions.length) {
    memStore.set(mk, active);
  }
  return active.length;
}

/** Exported for testing — allows inspecting the max concurrent sessions config */
export const _config = {
  get maxConcurrentSessions() {
    return WEB_MAX_SESSIONS;
  },
  get webMaxSessions() {
    return WEB_MAX_SESSIONS;
  },
  get mobileMaxSessions() {
    return MOBILE_MAX_SESSIONS;
  },
};
