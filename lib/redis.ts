/**
 * Shared Redis client singleton — Issue #178
 *
 * Connects to Redis using REDIS_URL env var.
 * Falls back gracefully if Redis is unavailable.
 *
 * Circuit-breaker: after first connection failure, skip
 * reconnection attempts for CIRCUIT_BREAKER_MS (60 s).
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

let _redis: Redis | null = null;

/** Circuit-breaker state — avoids reconnect storms. */
let _circuitOpen = false;
let _circuitOpenedAt = 0;
const CIRCUIT_BREAKER_MS = 60_000; // 60 seconds

/**
 * Returns the shared Redis client instance.
 * Returns null if REDIS_URL is not configured or circuit-breaker is open.
 */
export function getRedisClient(): Redis | null {
  if (_redis) return _redis;

  // Circuit-breaker: skip reconnection for 60 s after failure
  if (_circuitOpen) {
    if (Date.now() - _circuitOpenedAt < CIRCUIT_BREAKER_MS) {
      return null; // still in cooldown — no log noise
    }
    // Cooldown expired — allow one retry
    _circuitOpen = false;
    logger.info("[redis] Circuit-breaker cooldown expired, retrying connection");
  }

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
      // Only log once, then open circuit-breaker
      if (!_circuitOpen) {
        logger.error({ err }, "[redis] Connection error — opening circuit-breaker for 60 s");
        _circuitOpen = true;
        _circuitOpenedAt = Date.now();
        _redis?.disconnect();
        _redis = null;
      }
    });

    _redis.on("connect", () => {
      logger.info("[redis] Connected successfully");
      _circuitOpen = false;
    });

    _redis.connect().catch((err) => {
      logger.error({ err }, "[redis] Initial connection failed — opening circuit-breaker for 60 s");
      _circuitOpen = true;
      _circuitOpenedAt = Date.now();
      _redis = null;
    });

    return _redis;
  } catch (err) {
    logger.error({ err }, "[redis] Failed to create client");
    _circuitOpen = true;
    _circuitOpenedAt = Date.now();
    return null;
  }
}

/** Reset the singleton — used in tests. */
export function resetRedisClient(): void {
  if (_redis) {
    _redis.disconnect();
    _redis = null;
  }
  _circuitOpen = false;
  _circuitOpenedAt = 0;
}
