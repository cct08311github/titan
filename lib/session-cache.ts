/**
 * Request-level session cache — Issue #166
 *
 * Prevents redundant auth() calls when multiple security
 * middleware wrappers (withRateLimit, withAuditLog, withSessionTimeout,
 * withJwtBlacklist) all need the session for the same request.
 *
 * Uses a WeakMap so entries are automatically garbage-collected when
 * the Request object is no longer referenced.
 *
 * Updated for Auth.js v5 (Issue #200): uses auth() instead of getServerSession().
 */

import { auth } from "@/auth";
import type { NextRequest } from "next/server";

// Session type returned by auth().
// We use `unknown` here to avoid importing next-auth internals; callers
// can cast to their specific session shape.
export type CachedSession = Awaited<ReturnType<typeof auth>>;

const _cache = new WeakMap<NextRequest, CachedSession>();

/**
 * Returns the session for this request, fetching it from auth() only
 * on the first call per request object.  Subsequent calls return the
 * cached value without hitting the database again.
 */
export async function getCachedSession(req: NextRequest): Promise<CachedSession> {
  if (_cache.has(req)) {
    return _cache.get(req)!;
  }
  const session = await auth();
  _cache.set(req, session);
  return session;
}

/** Exposed for testing — allows injecting a pre-built session into the cache. */
export function setCachedSession(req: NextRequest, session: CachedSession): void {
  _cache.set(req, session);
}

/** Exposed for testing — clears the cache entry for a specific request. */
export function clearCachedSession(req: NextRequest): void {
  _cache.delete(req);
}
