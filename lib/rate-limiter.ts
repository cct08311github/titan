/**
 * Rate limiting with Redis backend and in-memory fallback — Issue #128
 *
 * Uses rate-limiter-flexible for both Redis and in-memory modes.
 *
 * Strategies:
 *   - Login:  20 attempts / 60s per IP+username key
 *   - API:    100 requests / 60s per userId
 *
 * When Redis is unavailable the factory falls back to RateLimiterMemory and
 * emits a console.warn so operators know degraded mode is active.
 */

import { RateLimiterMemory, RateLimiterRedis, IRateLimiterStoreOptions } from "rate-limiter-flexible";
import { logger } from "@/lib/logger";

// ── Error type ────────────────────────────────────────────────────────────

/**
 * Thrown when a rate limit is exceeded.
 * Maps to HTTP 429 Too Many Requests in apiHandler.
 */
export class RateLimitError extends Error {
  readonly statusCode = 429;
  readonly retryAfter: number;

  constructor(message = "請求過於頻繁，請稍後再試", retryAfterSeconds = 60) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfter = retryAfterSeconds;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Factory options ────────────────────────────────────────────────────────

export interface LoginRateLimiterOptions {
  /** Force in-memory store (used in tests or when Redis is unavailable). */
  useMemory?: boolean;
  /** Set to true to simulate Redis being unavailable (triggers warning). */
  redisUnavailable?: boolean;
  /** Override default points (5). Useful for tests. */
  points?: number;
  /** Override default duration in seconds (60). */
  duration?: number;
  /** Redis client instance (ioredis). Only used when useMemory is false. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisClient?: any;
}

export interface ApiRateLimiterOptions {
  useMemory?: boolean;
  redisUnavailable?: boolean;
  points?: number;
  duration?: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisClient?: any;
}

// ── Factory: login rate limiter ───────────────────────────────────────────

/**
 * Creates a rate limiter for login endpoints.
 * Default: 20 attempts per 60 seconds, keyed by IP+username.
 */
export function createLoginRateLimiter(
  opts: LoginRateLimiterOptions = {}
): RateLimiterMemory | RateLimiterRedis {
  const points = opts.points ?? 20;
  const duration = opts.duration ?? 60;
  const keyPrefix = "login";

  if (opts.redisUnavailable) {
    console.warn("[rate-limiter] Redis unavailable — falling back to in-memory rate limiter");
    logger.warn("[rate-limiter] Redis unavailable — falling back to in-memory rate limiter");
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }

  if (opts.useMemory || !opts.redisClient) {
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }

  const redisOpts: IRateLimiterStoreOptions = {
    storeClient: opts.redisClient,
    points,
    duration,
    keyPrefix,
  };

  return new RateLimiterRedis(redisOpts);
}

// ── Factory: API rate limiter ─────────────────────────────────────────────

/**
 * Creates a rate limiter for general API endpoints.
 * Default: 100 requests per 60 seconds, keyed by userId.
 */
export function createApiRateLimiter(
  opts: ApiRateLimiterOptions = {}
): RateLimiterMemory | RateLimiterRedis {
  const points = opts.points ?? 100;
  const duration = opts.duration ?? 60;
  const keyPrefix = "api";

  if (opts.redisUnavailable) {
    console.warn("[rate-limiter] Redis unavailable — falling back to in-memory rate limiter");
    logger.warn("[rate-limiter] Redis unavailable — falling back to in-memory rate limiter");
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }

  if (opts.useMemory || !opts.redisClient) {
    return new RateLimiterMemory({ points, duration, keyPrefix });
  }

  const redisOpts: IRateLimiterStoreOptions = {
    storeClient: opts.redisClient,
    points,
    duration,
    keyPrefix,
  };

  return new RateLimiterRedis(redisOpts);
}

// ── Consume helper ────────────────────────────────────────────────────────

/**
 * Attempts to consume one point from the rate limiter for the given key.
 * Throws RateLimitError (429) if the limit is exceeded.
 */
export async function checkRateLimit(
  limiter: RateLimiterMemory | RateLimiterRedis,
  key: string
): Promise<void> {
  try {
    await limiter.consume(key);
  } catch (rlRes) {
    // rate-limiter-flexible throws a RateLimiterRes object when exhausted
    const retryAfter =
      rlRes && typeof (rlRes as { msBeforeNext?: number }).msBeforeNext === "number"
        ? Math.ceil((rlRes as { msBeforeNext: number }).msBeforeNext / 1000)
        : 60;

    logger.warn({ key, retryAfter }, "[rate-limiter] Rate limit exceeded");
    throw new RateLimitError("請求過於頻繁，請稍後再試", retryAfter);
  }
}
