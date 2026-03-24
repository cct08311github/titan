/**
 * Concurrent session limiter — Issue #184
 *
 * Enforces single active session per user. When a user logs in,
 * the new session token replaces the old one. The old session
 * is effectively invalidated via the JWT blacklist.
 *
 * Uses Redis when available, falls back to in-memory Map.
 */

import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { JwtBlacklist } from "@/lib/jwt-blacklist";

const REDIS_PREFIX = "active_session:";
const SESSION_TTL = 8 * 60 * 60; // 8 hours (matches JWT maxAge)

/** In-memory fallback: userId → sessionId */
const memStore = new Map<string, string>();

/**
 * Register a new session for a user, invalidating any previous session.
 */
export async function registerSession(
  userId: string,
  sessionId: string
): Promise<void> {
  const redis = getRedisClient();

  // Get the old session ID
  let oldSessionId: string | null = null;

  if (redis) {
    try {
      oldSessionId = await redis.get(`${REDIS_PREFIX}${userId}`);
      await redis.set(`${REDIS_PREFIX}${userId}`, sessionId, "EX", SESSION_TTL);
    } catch (err) {
      logger.error({ err }, "[session-limiter] Redis error, using memory fallback");
      oldSessionId = memStore.get(userId) ?? null;
      memStore.set(userId, sessionId);
    }
  } else {
    oldSessionId = memStore.get(userId) ?? null;
    memStore.set(userId, sessionId);
  }

  // Blacklist the old session if it exists and differs
  if (oldSessionId && oldSessionId !== sessionId) {
    JwtBlacklist.add(`session:${oldSessionId}`);
    logger.info(
      { userId },
      "[session-limiter] Previous session invalidated (concurrent login)"
    );
  }
}

/**
 * Check if a session is still the active one for its user.
 */
export async function isSessionActive(
  userId: string,
  sessionId: string
): Promise<boolean> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const active = await redis.get(`${REDIS_PREFIX}${userId}`);
      return active === sessionId;
    } catch {
      // fallback
    }
  }

  return memStore.get(userId) === sessionId;
}

/**
 * Clear a user's active session (on logout).
 */
export async function clearSession(userId: string): Promise<void> {
  const redis = getRedisClient();

  if (redis) {
    try {
      await redis.del(`${REDIS_PREFIX}${userId}`);
      return;
    } catch {
      // fallback
    }
  }

  memStore.delete(userId);
}
