/**
 * JWT Blacklist — Issue #153
 *
 * Distributed store of revoked JWT tokens (and userId-based keys for suspended
 * users) using Redis as primary storage with in-memory fallback.
 *
 * Lives in its own module so it can be imported by service-layer code
 * (e.g. UserService) without pulling in next/server.
 *
 * Redis storage uses Set: SADD/SISMEMBER/SREM for atomic operations.
 * Falls back to in-memory Set when Redis is unavailable (circuit-breaker open).
 */
import { getRedisClient } from "@/lib/redis";
import { logger } from "@/lib/logger";

const REDIS_KEY_PREFIX = "titan:jwt:blacklist:";
const MEM_TTL_MS = 60 * 60 * 1000; // 1 hour — tokens expire from memory after this
const REDIS_TTL_SECONDS = 60 * 60; // 1 hour — matches in-memory TTL; exceeds 15min access token max age

export class JwtBlacklist {
  /** In-memory fallback — used when Redis circuit-breaker is open. */
  private static readonly _memMap = new Map<string, number>();

  /** Add a token or userId key to the blacklist. */
  static add(token: string): void {
    // Always add to memory first — synchronous, O(1), used by has() in hot path
    this._memMap.set(token, Date.now() + MEM_TTL_MS);

    const redis = getRedisClient();
    if (redis) {
      const key = `${REDIS_KEY_PREFIX}${token}`;
      // Fire-and-forget Redis add with TTL — do not await
      // Pipeline ensures SADD + EXPIRE are sent as a single round-trip
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      redis
        .pipeline()
        .sadd(key, "1")
        .expire(key, REDIS_TTL_SECONDS)
        .exec()
        .catch((err) => {
          logger.warn({ err, token }, "[jwt-blacklist] Redis pipeline failed");
        });
    }
  }

  /**
   * Check whether a token/key is blacklisted.
   *
   * Memory-first for O(1) hot-path performance.
   * Falls back to Redis for cross-instance consistency (token may have been
   * blacklisted on a different server instance).
   *
   * If found in Redis but not memory, populates memory for subsequent fast lookups.
   * Expired in-memory entries are purged on access.
   */
  static async has(token: string): Promise<boolean> {
    // Fast path: memory lookup (synchronous)
    const expiry = this._memMap.get(token);
    if (expiry !== undefined) {
      if (Date.now() < expiry) {
        return true;
      }
      // Expired — remove synchronously
      this._memMap.delete(token);
      return false;
    }

    // Cross-instance path: check Redis (token may have been added by another instance)
    const redis = getRedisClient();
    if (redis) {
      try {
        const exists = await redis.sismember(`${REDIS_KEY_PREFIX}${token}`, "1");
        if (exists === 1 || Number(exists) === 1) {
          // Populate memory for next lookup
          this._memMap.set(token, Date.now() + MEM_TTL_MS);
          return true;
        }
      } catch (err) {
        logger.warn({ err, token }, "[jwt-blacklist] Redis SISMEMBER failed");
      }
    }

    return false;
  }

  /** Remove a token/key from the blacklist (e.g. on unsuspend). */
  static remove(token: string): void {
    // Always remove from memory first — synchronous, O(1)
    this._memMap.delete(token);

    const redis = getRedisClient();
    if (redis) {
      // Fire-and-forget Redis remove — do not await
      // eslint-disable-next-line @typescript-eslint/no-floating-promises
      redis.srem(`${REDIS_KEY_PREFIX}${token}`, "1").catch((err) => {
        logger.warn({ err, token }, "[jwt-blacklist] Redis SREM failed");
      });
    }
  }

  /** Clear all entries — used in tests. */
  static clear(): void {
    this._memMap.clear();
    // Redis keys auto-expire via REDIS_TTL_SECONDS (set in add())
    // For test isolation, tests should use unique session/user IDs
  }

  /** Return the current in-memory size — used in tests. */
  static get size(): number {
    return this._memMap.size;
  }
}
