/**
 * Shared Redis client singleton — Issue #178 / #1285
 *
 * Connects to Redis using REDIS_URL env var.
 * Falls back gracefully if Redis is unavailable.
 *
 * Circuit-breaker: after first connection failure, schedules automatic
 * reconnect attempts every 30 s, up to MAX_RETRIES times before entering
 * a longer 5-minute cooldown.
 */

import Redis from "ioredis";
import { logger } from "@/lib/logger";

let _redis: Redis | null = null;

/** Circuit-breaker state — avoids reconnect storms. */
let _circuitOpen = false;
let _circuitOpenedAt = 0;

/** Reconnect retry state — Issue #1285 */
let _retryCount = 0;
let _retryTimer: ReturnType<typeof setTimeout> | null = null;

const CIRCUIT_BREAKER_MS = 60_000;  // 60 s (kept for API compatibility)
const RETRY_INTERVAL_MS  = 30_000;  // retry every 30 s
const MAX_RETRIES         = 3;       // give up after 3 retries → 5-min cooldown
const LONG_COOLDOWN_MS    = 300_000; // 5 minutes after exhausting retries

/**
 * Returns the shared Redis client instance.
 * Returns null if REDIS_URL is not configured or circuit-breaker is open.
 */
export function getRedisClient(): Redis | null {
  if (_redis) return _redis;

  // Circuit-breaker: skip reconnection while in cooldown
  if (_circuitOpen) {
    const cooldown = _retryCount >= MAX_RETRIES ? LONG_COOLDOWN_MS : CIRCUIT_BREAKER_MS;
    if (Date.now() - _circuitOpenedAt < cooldown) {
      return null; // still in cooldown — no log noise
    }
    // Cooldown expired — allow one retry attempt
    _circuitOpen = false;
    logger.info("[redis] Circuit-breaker cooldown expired, retrying connection");
  }

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.warn("[redis] REDIS_URL not set — security services will use in-memory fallback");
    return null;
  }

  return _createClient(url);
}

/**
 * Internal: create and wire up a Redis client.
 * Extracted so _scheduleRetry can call it without going through getRedisClient().
 */
function _createClient(url: string): Redis | null {
  try {
    _redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null; // stop internal ioredis retries
        return Math.min(times * 200, 2000);
      },
      lazyConnect: true,
    });

    _redis.on("error", (err) => {
      // Only log once per circuit-open event
      if (!_circuitOpen) {
        logger.error({ err }, "[redis] Connection error — opening circuit-breaker");
        _circuitOpen = true;
        _circuitOpenedAt = Date.now();
        _redis?.disconnect();
        _redis = null;
        _scheduleRetry(url);
      }
    });

    _redis.on("connect", () => {
      logger.info("[redis] Connected successfully");
      _circuitOpen = false;
      _retryCount = 0;
      // Cancel any pending retry timer
      if (_retryTimer) {
        clearTimeout(_retryTimer);
        _retryTimer = null;
      }
    });

    _redis.connect().catch((err) => {
      logger.error({ err }, "[redis] Initial connection failed — opening circuit-breaker");
      _circuitOpen = true;
      _circuitOpenedAt = Date.now();
      _redis = null;
      _scheduleRetry(url);
    });

    return _redis;
  } catch (err) {
    logger.error({ err }, "[redis] Failed to create client");
    _circuitOpen = true;
    _circuitOpenedAt = Date.now();
    _scheduleRetry(url);
    return null;
  }
}

/**
 * Schedule a reconnect attempt after RETRY_INTERVAL_MS.
 * After MAX_RETRIES exhausted, enters 5-minute cooldown instead.
 */
function _scheduleRetry(url: string): void {
  // Cancel any existing retry timer to avoid duplicates
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }

  if (_retryCount >= MAX_RETRIES) {
    logger.warn(
      `[redis] ${MAX_RETRIES} retries exhausted — entering 5-minute cooldown before next attempt`
    );
    // Reset counter so after 5 min we try again from scratch
    _retryTimer = setTimeout(() => {
      _retryTimer = null;
      _retryCount = 0;
      _circuitOpen = false;
      logger.info("[redis] 5-minute cooldown expired, attempting reconnect");
      _createClient(url);
    }, LONG_COOLDOWN_MS);
    return;
  }

  _retryCount++;
  logger.info(
    `[redis] Scheduling reconnect attempt ${_retryCount}/${MAX_RETRIES} in ${RETRY_INTERVAL_MS / 1000}s`
  );
  _retryTimer = setTimeout(() => {
    _retryTimer = null;
    logger.info(`[redis] Reconnect attempt ${_retryCount}/${MAX_RETRIES}`);
    _circuitOpen = false;
    _createClient(url);
  }, RETRY_INTERVAL_MS);
}

/** Reset the singleton — used in tests. */
export function resetRedisClient(): void {
  if (_retryTimer) {
    clearTimeout(_retryTimer);
    _retryTimer = null;
  }
  if (_redis) {
    _redis.disconnect();
    _redis = null;
  }
  _circuitOpen = false;
  _circuitOpenedAt = 0;
  _retryCount = 0;
}
