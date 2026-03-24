/**
 * Shared Redis client singleton — Issue #178
 *
 * Connects to Redis using REDIS_URL env var.
 * Falls back gracefully if Redis is unavailable.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

let _redis: Redis | null = null;

/**
 * Returns the shared Redis client instance.
 * Returns null if REDIS_URL is not configured.
 */
export function getRedisClient(): Redis | null {
  if (_redis) return _redis;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn("[redis] REDIS_URL not set — security services will use in-memory fallback");
    return null;
  }

  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null; // stop retrying
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    _redis.on("error", (err) => {
      logger.error({ err }, "[redis] Connection error");
    });

    _redis.on("connect", () => {
      logger.info("[redis] Connected successfully");
    });

    _redis.connect().catch((err) => {
      logger.error({ err }, "[redis] Initial connection failed — falling back to in-memory");
      _redis = null;
    });

    return _redis;
  } catch (err) {
    logger.error({ err }, "[redis] Failed to create client");
    return null;
  }
}

/** Reset the singleton — used in tests. */
export function resetRedisClient(): void {
  if (_redis) {
    _redis.disconnect();
    _redis = null;
  }
}
