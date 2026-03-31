/**
 * Security middleware chain — Issue #153
 *
 * Provides composable middleware wrappers for API route handlers:
 *
 *   1. withRateLimit     — consumes one API rate-limit point per userId
 *   2. withAuditLog      — auto-logs POST/PUT/PATCH/DELETE after success
 *   3. withSessionTimeout — rejects requests whose session last-activity > 30 min
 *   4. withJwtBlacklist  — rejects requests whose JWT belongs to a suspended user
 *
 * None of these mutate apiHandler internally; they compose via the same
 * higher-order wrapper pattern used by withAuth / withManager.
 *
 * Usage:
 *   export const POST = withRateLimit(
 *     withAuditLog(
 *       withAuth(async (req) => { ... })
 *     )
 *   );
 */

import { NextRequest, NextResponse } from "next/server";
import type { ApiResponse } from "@/lib/api-response";
import { getCachedSession } from "@/lib/session-cache";
import { error } from "@/lib/api-response";
import { logger } from "@/lib/logger";
import {
  createApiRateLimiter,
  checkRateLimit,
  type ApiRateLimiterOptions,
} from "@/lib/rate-limiter";
import { AuditService } from "@/services/audit-service";
import { prisma } from "@/lib/prisma";
import type { RouteContext } from "@/lib/api-handler";
import { JwtBlacklist } from "@/lib/jwt-blacklist";
import { getRedisClient } from "@/lib/redis";
export { JwtBlacklist } from "@/lib/jwt-blacklist";

// ---------------------------------------------------------------------------
// Shared API rate limiter singleton (in-memory; swapped for Redis in prod)
// ---------------------------------------------------------------------------

let _apiReadLimiter: ReturnType<typeof createApiRateLimiter> | null = null;
let _apiMutateLimiter: ReturnType<typeof createApiRateLimiter> | null = null;

/**
 * Returns the shared API rate limiter for GET requests (100 req/60s).
 */
export function getApiReadLimiter(opts: ApiRateLimiterOptions = {}) {
  if (!_apiReadLimiter) {
    const redis = getRedisClient();
    _apiReadLimiter = createApiRateLimiter({
      ...opts,
      points: 100,
      duration: 60,
      redisClient: redis ?? undefined,
      useMemory: !redis,
    });
  }
  return _apiReadLimiter;
}

/**
 * Returns the shared API rate limiter for mutating requests (20 req/60s).
 * POST/PUT/PATCH/DELETE have a stricter limit to protect write operations.
 */
export function getApiMutateLimiter(opts: ApiRateLimiterOptions = {}) {
  if (!_apiMutateLimiter) {
    const redis = getRedisClient();
    _apiMutateLimiter = createApiRateLimiter({
      ...opts,
      points: 20,
      duration: 60,
      redisClient: redis ?? undefined,
      useMemory: !redis,
    });
  }
  return _apiMutateLimiter;
}

/** @deprecated Use getApiReadLimiter or getApiMutateLimiter instead. */
export function getApiRateLimiter(opts: ApiRateLimiterOptions = {}) {
  return getApiReadLimiter(opts);
}

/** Replace the singletons — used in tests to inject custom limiters. */
export function setApiRateLimiter(
  limiter: ReturnType<typeof createApiRateLimiter> | null
) {
  _apiReadLimiter = limiter;
  _apiMutateLimiter = limiter;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (req: NextRequest, context?: any) => Promise<NextResponse<ApiResponse>>;

/** Extract Bearer token from Authorization header. */
function extractBearer(req: NextRequest): string | null {
  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    return auth.slice(7).trim() || null;
  }
  return null;
}

/** Extract userId from the session (null if unauthenticated). */
async function getSessionUserId(req: NextRequest): Promise<string | null> {
  // Prefer X-User-Id header injected by tests / other middleware.
  const override = req.headers.get("x-user-id");
  if (override) return override;

  const session = await getCachedSession(req);
  return ((session as { user?: { id?: string } } | null)?.user)?.id ?? null;
}

/** Derive resourceType from URL path (e.g. /api/tasks/123 → "tasks"). */
function resourceTypeFromPath(pathname: string): string {
  // Strip leading /api/ and take the first segment.
  const match = pathname.match(/^\/api\/([^/]+)/);
  return match?.[1] ?? "unknown";
}

/** Derive resourceId from URL path (e.g. /api/tasks/123 → "123"). */
function resourceIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/api\/[^/]+\/([^/?]+)/);
  return match?.[1] ?? null;
}

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// ---------------------------------------------------------------------------
// 1. withRateLimit
// ---------------------------------------------------------------------------

/**
 * Middleware wrapper: consumes one API rate-limit point per userId.
 * Skips the login endpoint (which has its own dedicated limiter).
 * Throws RateLimitError (→ 429) when the limit is exceeded.
 */
export function withRateLimit<T extends AnyHandler>(fn: T): T {
  const wrapped = async (
    req: NextRequest,
    context?: RouteContext
  ): Promise<NextResponse<ApiResponse>> => {
    const { pathname } = new URL(req.url);

    // Login has its own dedicated limiter — skip here.
    if (pathname.startsWith("/api/auth/")) {
      return fn(req, context);
    }

    const userId = await getSessionUserId(req);
    if (userId) {
      // Differentiated rate limits: mutating ops = 20/60s, reads = 100/60s
      const method = req.method?.toUpperCase() ?? "GET";
      const isMutating = MUTATING_METHODS.has(method);
      const limiter = isMutating
        ? getApiMutateLimiter()
        : getApiReadLimiter();
      await checkRateLimit(limiter, `${userId}:${isMutating ? "write" : "read"}`);
    }

    return fn(req, context);
  };
  return wrapped as unknown as T;
}

// ---------------------------------------------------------------------------
// 2. withAuditLog
// ---------------------------------------------------------------------------

const auditService = new AuditService(prisma);

/**
 * Middleware wrapper: after a successful POST/PUT/PATCH/DELETE, automatically
 * calls AuditService.log() with action, resourceType, resourceId, and userId.
 *
 * The outer fn is called first; audit logging only fires on success (2xx).
 * Errors propagate untouched.
 */
export function withAuditLog<T extends AnyHandler>(fn: T): T {
  const wrapped = async (
    req: NextRequest,
    context?: RouteContext
  ): Promise<NextResponse<ApiResponse>> => {
    const method = req.method?.toUpperCase() ?? "GET";
    const response = await fn(req, context);

    if (MUTATING_METHODS.has(method) && response.status >= 200 && response.status < 300) {
      try {
        const { pathname } = new URL(req.url);
        const userId = await getSessionUserId(req);
        const resourceType = resourceTypeFromPath(pathname);
        const resourceId = resourceIdFromPath(pathname);
        const action = `${method}_${resourceType.toUpperCase()}`;

        await auditService.log({
          userId,
          action,
          resourceType,
          resourceId,
        });
      } catch (auditErr) {
        // Audit failures must never block the response — log and continue.
        logger.error({ err: auditErr }, "[withAuditLog] Failed to write audit log");
      }
    }

    return response;
  };
  return wrapped as unknown as T;
}

// ---------------------------------------------------------------------------
// 3. withSessionTimeout
// ---------------------------------------------------------------------------

const SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_IDLE_TIMEOUT_S = 30 * 60; // 30 minutes in seconds
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Server-side last-activity store keyed by userId (unix ms timestamp).
 *
 * Issue #178: Uses Redis when available, falls back to in-memory Map.
 * Exported so tests can inspect or reset it.
 */
export const sessionLastActivity = new Map<string, number>();

const SESSION_REDIS_PREFIX = "sess_activity:";

/** Get last activity from Redis or memory. */
async function getLastActivity(userId: string): Promise<number | undefined> {
  const redis = getRedisClient();
  if (redis) {
    try {
      const val = await redis.get(`${SESSION_REDIS_PREFIX}${userId}`);
      return val ? parseInt(val, 10) : undefined;
    } catch {
      // fallback to memory
    }
  }
  return sessionLastActivity.get(userId);
}

/** Set last activity in Redis or memory. */
async function setLastActivity(userId: string, now: number): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.set(
        `${SESSION_REDIS_PREFIX}${userId}`,
        now.toString(),
        "EX",
        SESSION_IDLE_TIMEOUT_S * 2
      );
      return;
    } catch {
      // fallback to memory
    }
  }
  sessionLastActivity.set(userId, now);
}

/** Delete last activity from Redis or memory. */
async function deleteLastActivity(userId: string): Promise<void> {
  const redis = getRedisClient();
  if (redis) {
    try {
      await redis.del(`${SESSION_REDIS_PREFIX}${userId}`);
      return;
    } catch {
      // fallback to memory
    }
  }
  sessionLastActivity.delete(userId);
}

/**
 * Throttled cleanup: removes entries that have been idle longer than
 * 2x the timeout window. Runs at most once per CLEANUP_INTERVAL_MS.
 * Only needed for in-memory store (Redis uses TTL).
 */
let _lastCleanup = Date.now();
export function _cleanupStaleEntries(now: number): void {
  if (now - _lastCleanup < CLEANUP_INTERVAL_MS) return;
  _lastCleanup = now;
  const staleThreshold = SESSION_IDLE_TIMEOUT_MS * 2;
  for (const [uid, ts] of sessionLastActivity) {
    if (now - ts > staleThreshold) {
      sessionLastActivity.delete(uid);
    }
  }
}

/** Reset cleanup timer — used in tests. */
export function _resetCleanupTimer(): void {
  _lastCleanup = 0;
}

/**
 * Middleware wrapper: tracks last activity per userId on the server side.
 * Rejects with HTTP 401 if the session has been idle for more than 30 minutes.
 *
 * The previous implementation trusted the client-supplied
 * X-Session-Last-Activity header, which allowed clients to bypass the timeout
 * by sending a fake timestamp — Issue #165.  This version ignores that header
 * entirely and relies on server-side state only.
 */
export function withSessionTimeout<T extends AnyHandler>(fn: T): T {
  const wrapped = async (
    req: NextRequest,
    context?: RouteContext
  ): Promise<NextResponse<ApiResponse>> => {
    const userId = await getSessionUserId(req);

    if (userId) {
      const now = Date.now();
      const lastActivity = await getLastActivity(userId);

      if (lastActivity !== undefined) {
        const idleMs = now - lastActivity;
        if (idleMs > SESSION_IDLE_TIMEOUT_MS) {
          await deleteLastActivity(userId);
          logger.warn(
            { idleMs, userId },
            "[withSessionTimeout] Session idle timeout exceeded"
          );
          return error("UnauthorizedError", "Session expired — please log in again", 401) as NextResponse<ApiResponse>;
        }
      }

      // Update last-activity timestamp on every valid request.
      await setLastActivity(userId, now);

      // Periodically sweep stale entries in memory fallback
      _cleanupStaleEntries(now);
    }

    return fn(req, context);
  };
  return wrapped as unknown as T;
}

// ---------------------------------------------------------------------------
// 4. withJwtBlacklist
// ---------------------------------------------------------------------------

/**
 * Middleware wrapper: checks the Bearer token against the JWT blacklist.
 * Rejects with HTTP 401 if the token has been blacklisted (e.g. suspended user).
 *
 * Also checks userId-based blacklist key (set by suspendUser) by resolving
 * the userId from the server-side session — never trusts client headers
 * in production to prevent bypass.
 */
export function withJwtBlacklist<T extends AnyHandler>(fn: T): T {
  const wrapped = async (
    req: NextRequest,
    context?: RouteContext
  ): Promise<NextResponse<ApiResponse>> => {
    const token = extractBearer(req);
    if (token && await JwtBlacklist.has(token)) {
      logger.warn("[withJwtBlacklist] Blacklisted JWT rejected");
      return error("UnauthorizedError", "Token has been revoked", 401) as NextResponse<ApiResponse>;
    }

    // Check userId-based blacklist key (set by suspendUser).
    // Resolve userId from session to prevent header-spoofing bypass.
    const userId = await getSessionUserId(req);
    if (userId && await JwtBlacklist.has(`user:${userId}`)) {
      logger.warn({ userId }, "[withJwtBlacklist] Suspended user JWT rejected");
      return error("UnauthorizedError", "Account suspended", 401) as NextResponse<ApiResponse>;
    }

    return fn(req, context);
  };
  return wrapped as unknown as T;
}
