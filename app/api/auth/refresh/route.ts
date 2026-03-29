/**
 * POST /api/auth/refresh — Issue #795 (AU-1), enhanced Issue #1085
 *
 * Exchange a refresh token for a new token pair.
 * Implements refresh token rotation (old token immediately invalidated).
 *
 * Issue #1085: Also returns a JWE access token for mobile clients.
 * Mobile clients send `source: "mobile"` to get the JWE token.
 * Web clients continue to receive only the refresh token (access via cookie).
 */

import { NextRequest } from "next/server";
import { encode } from "next-auth/jwt";
import { success, error } from "@/lib/api-response";
import { rotateRefreshToken } from "@/lib/auth/jwt";
import { registerSession } from "@/lib/session-limiter";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";
import { isPasswordExpired } from "@/lib/password-expiry";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const ACCESS_TOKEN_MAX_AGE = 15 * 60; // 15 minutes
const SESSION_COOKIE_NAME = "authjs.session-token";

export async function POST(req: NextRequest) {
  let body: { refreshToken?: string; source?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { refreshToken, source, deviceId } = body;
  if (!refreshToken) {
    return error("ValidationError", "缺少 refresh token", 400);
  }

  // Issue #1085: Pass deviceId for device binding verification on mobile
  const result = await rotateRefreshToken(refreshToken, deviceId);
  if (!result) {
    return error("UnauthorizedError", "Refresh token 無效或已過期", 401);
  }

  // Fetch user for token payload
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: {
      id: true, name: true, email: true, role: true, isActive: true,
      mustChangePassword: true, passwordChangedAt: true,
    },
  });

  if (!user || !user.isActive) {
    return error("UnauthorizedError", "帳號已停用", 401);
  }

  logger.info({ userId: user.id, source: source ?? "web" }, "[auth] Token refreshed successfully");

  // Issue #1085: Audit log for mobile token refresh
  if (source === "mobile") {
    const auditService = new AuditService(prisma);
    auditService.log({
      userId: user.id,
      action: "MOBILE_TOKEN_REFRESH",
      resourceType: "Auth",
      resourceId: user.id,
      detail: JSON.stringify({ deviceId: deviceId ?? null }),
      ipAddress: getClientIp(req),
    }).catch(() => {});
  }

  // Base response (backward compatible with web clients)
  const responseData: Record<string, unknown> = {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    refreshToken: result.newToken,
    expiresIn: ACCESS_TOKEN_MAX_AGE,
  };

  // Issue #1085: Mobile clients get a JWE access token
  if (source === "mobile") {
    const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
    if (!secret) {
      return error("ServerError", "伺服器設定錯誤", 500);
    }

    const mustChangePassword =
      user.mustChangePassword || isPasswordExpired(user.passwordChangedAt);

    // [SA C-2] Register new session for mobile refresh.
    // Old session entry expires naturally via SESSION_TTL (8h) in session-limiter.
    // The new session registration will evict the oldest if limit exceeded.
    const newSessionId = crypto.randomUUID();
    await registerSession(user.id, newSessionId);

    const accessToken = await encode({
      token: {
        id: user.id,
        role: user.role,
        mustChangePassword,
        passwordChangedAt: user.passwordChangedAt?.toISOString() ?? null,
        sessionId: newSessionId,
        name: user.name,
        email: user.email,
      },
      secret,
      salt: SESSION_COOKIE_NAME,
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });

    responseData.token = accessToken;
    responseData.expiresAt = Math.floor(Date.now() / 1000) + ACCESS_TOKEN_MAX_AGE;
  }

  return success(responseData);
}
