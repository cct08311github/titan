/**
 * POST /api/auth/mobile/login — Issue #1085
 *
 * Mobile login endpoint. Validates credentials (reusing existing auth logic),
 * then returns a JWE access token (produced by Auth.js encode() for Edge
 * middleware compatibility) plus a refresh token with device binding.
 *
 * This endpoint bypasses NextAuth's cookie-based flow and directly returns
 * tokens for mobile clients to store in secure storage (iOS Keychain).
 */

import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { compare } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { issueRefreshToken } from "@/lib/auth/jwt";
import { createLoginRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { AccountLockService } from "@/lib/account-lock";
import { isPasswordExpired } from "@/lib/password-expiry";
import { registerSession } from "@/lib/session-limiter";
import { logger } from "@/lib/logger";
import { getRedisClient } from "@/lib/redis";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const redis = getRedisClient();
const loginRateLimiter = createLoginRateLimiter({
  redisClient: redis ?? undefined,
  useMemory: !redis,
});
const accountLockService = new AccountLockService({
  maxFailures: 5,
  lockDurationSeconds: 1800,
  redisClient: redis,
});
const auditService = new AuditService(prisma);

/** Access token TTL — must match auth.ts session.maxAge */
const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes

/**
 * Session cookie name used by Auth.js as HKDF salt.
 * Must match the sessionToken cookie name in auth.ts.
 */
const SESSION_COOKIE_NAME = "authjs.session-token";

export async function POST(req: NextRequest) {
  // [CR #2] Early check — fail fast before wasting bcrypt/DB/lockout resources
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    logger.error("[mobile-auth] AUTH_SECRET not set");
    return error("ServerError", "伺服器設定錯誤", 500);
  }

  let body: { username?: string; password?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { username: rawUsername, password, deviceId } = body;

  if (!rawUsername || !password) {
    return error("ValidationError", "缺少帳號或密碼", 400);
  }

  if (!deviceId) {
    return error("ValidationError", "缺少 deviceId", 400);
  }

  const username = rawUsername.includes("@") ? rawUsername : `${rawUsername}@titan.local`;
  const ip = getClientIp(req) ?? "unknown";
  const rateLimitKey = `${ip}_${username}`;
  const lockKey = username;

  // 1. Check account lockout
  const locked = await accountLockService.isLocked(lockKey);
  if (locked) {
    const remaining = await accountLockService.getRemainingLockSeconds(lockKey);
    logger.warn({ username, ip, remaining }, "[mobile-auth] Login blocked — account locked");
    return error("AccountLockedError", `帳號已鎖定，請於 ${Math.ceil((remaining ?? 0) / 60)} 分鐘後再試`, 423);
  }

  // 2. Rate limiting (skip in dev)
  if (process.env.NODE_ENV !== "development") {
    try {
      await checkRateLimit(loginRateLimiter, rateLimitKey);
    } catch {
      logger.warn({ username, ip }, "[mobile-auth] Rate limit exceeded");
      return error("RateLimitError", "登入嘗試過於頻繁，請稍後再試", 429);
    }
  }

  // 3. Look up user
  const user = await prisma.user.findUnique({
    where: { email: username },
  });

  if (!user || !user.isActive) {
    await accountLockService.recordFailure(lockKey);
    auditService.log({
      userId: null,
      action: "MOBILE_LOGIN_FAILURE",
      resourceType: "Auth",
      resourceId: null,
      detail: JSON.stringify({
        username,
        deviceId,
        reason: !user ? "user_not_found" : "account_inactive",
      }),
      ipAddress: ip,
    }).catch(() => {});
    return error("UnauthorizedError", "帳號或密碼錯誤", 401);
  }

  // 4. Validate password
  const isValid = await compare(password, user.password);
  if (!isValid) {
    await accountLockService.recordFailure(lockKey);
    logger.warn({ username, ip, deviceId }, "[mobile-auth] Failed login attempt");
    auditService.log({
      userId: user.id,
      action: "MOBILE_LOGIN_FAILURE",
      resourceType: "Auth",
      resourceId: user.id,
      detail: JSON.stringify({ username, deviceId, reason: "invalid_password" }),
      ipAddress: ip,
    }).catch(() => {});
    return error("UnauthorizedError", "帳號或密碼錯誤", 401);
  }

  // 5. Success — clear failure counter
  await accountLockService.resetFailures(lockKey);

  // 6. Check password expiry
  const mustChangePassword =
    user.mustChangePassword || isPasswordExpired(user.passwordChangedAt);

  // 7. Generate session ID and register (for concurrent session limiting)
  const sessionId = crypto.randomUUID();
  await registerSession(user.id, sessionId);

  // 8. Produce JWE access token using Auth.js encode()
  //    This produces the exact same JWE format that checkEdgeJwt() expects,
  //    using HKDF with the session cookie name as salt.
  //    (secret already validated at function entry — CR #2)
  const accessToken = await encode({
    token: {
      id: user.id,
      role: user.role,
      mustChangePassword,
      passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
      sessionId,
      name: user.name,
      email: user.email,
    },
    secret,
    salt: SESSION_COOKIE_NAME,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });

  // 9. Issue refresh token (stored as SHA-256 hash in DB)
  // Issue #1085: Device-bound refresh token
  const refreshToken = await issueRefreshToken(user.id, deviceId);

  // 10. Audit log
  auditService.log({
    userId: user.id,
    action: "MOBILE_LOGIN_SUCCESS",
    resourceType: "Auth",
    resourceId: user.id,
    detail: JSON.stringify({ username, deviceId }),
    ipAddress: ip,
  }).catch(() => {});

  logger.info({ userId: user.id, deviceId }, "[mobile-auth] Successful login");

  return success({
    token: accessToken,
    refreshToken,
    expiresAt: Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword,
    },
  });
}
