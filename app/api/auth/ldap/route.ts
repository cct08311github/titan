/**
 * LDAP Authentication API Endpoint (Stub)
 * Sprint 2 — Task 19
 *
 * POST /api/auth/ldap
 * Body: { username: string, password: string }
 *
 * Returns 501 Not Implemented until LDAP is connected.
 * Issue #1216: rate-limited to prevent abuse even in stub mode.
 */

import { NextRequest } from "next/server";
import { LdapClient } from "@/lib/auth/ldap-client";
import { createLoginRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { getRedisClient } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";
import { success, error } from "@/lib/api-response";

const redis = getRedisClient();
const isTestEnv = process.env.NODE_ENV === "test" || process.env.E2E_TESTING === "true";
const ldapRateLimiter = createLoginRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
  points: isTestEnv ? 10000 : undefined,
});

export async function POST(request: NextRequest) {
  // Issue #1216: basic rate limiting on stub endpoint
  const ip = getClientIp(request) ?? "unknown";
  try {
    await checkRateLimit(ldapRateLimiter, `ldap_${ip}`);
  } catch {
    return error("RateLimitError", "Too many requests", 429);
  }

  try {
    const body = await request.json();
    const { username, password } = body;

    if (!username || !password) {
      return error("ValidationError", "Missing username or password", 400);
    }

    const client = new LdapClient();

    try {
      const result = await client.authenticate(username, password);

      if (result.success && result.user) {
        return success({
          name: result.user.displayName,
          email: result.user.mail,
          department: result.user.department,
        });
      }

      // Stub returns 501 until real LDAP is configured
      return error(result.error || "AuthenticationFailed", "Authentication failed", 501);
    } finally {
      await client.disconnect();
    }
  } catch (err) {
    return error("InternalError", "Internal server error", 500);
  }
}
