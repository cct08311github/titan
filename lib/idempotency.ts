/**
 * Idempotency key support for write operations.
 *
 * Uses Redis SETNX with TTL to detect duplicate requests.
 * When a retry sends the same X-Idempotency-Key header within
 * the TTL window, the server returns 409 Conflict instead of
 * applying the write twice.
 *
 * Redis key format: `idem:<key>`
 * Value: ISO timestamp of first request
 * TTL: 24 hours (86400 s)
 */

import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";

const IDEMPOTENCY_PREFIX = "idem:";
const IDEMPOTENCY_TTL_SECONDS = 86_400; // 24 hours

/**
 * Check if an idempotency key has already been seen.
 * @returns true if this is a duplicate (already processed), false if new.
 */
export async function isDuplicateIdempotencyKey(key: string): Promise<boolean> {
  const redis = getRedisClient();
  if (!redis) {
    // Redis unavailable: allow the request (fail open — idempotency is best-effort)
    logger.warn("[idempotency] Redis unavailable — skipping duplicate check");
    return false;
  }

  const redisKey = `${IDEMPOTENCY_PREFIX}${key}`;
  try {
    // SET with NX returns "OK" if the key was set (i.e., it didn't exist),
    // and null if the key already exists (duplicate).
    const result = await redis.set(redisKey, new Date().toISOString(), "EX", IDEMPOTENCY_TTL_SECONDS, "NX");
    if (result === null) {
      // Key already exists — this is a duplicate
      logger.info(`[idempotency] Duplicate key detected: ${key}`);
      return true;
    }
    return false;
  } catch (err) {
    logger.error({ err }, "[idempotency] Redis error — allowing request");
    return false;
  }
}
