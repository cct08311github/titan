/**
 * POST /api/auth/mobile/logout — Issue #1087
 *
 * Mobile logout endpoint. Validates the Bearer token, revokes the
 * refresh token for the user+device pair, clears the session from
 * the session limiter, blacklists the JWT, and writes an audit log.
 *
 * Spec reference: docs/mobile-app-plan.md lines 135-140
 */

import { NextRequest } from "next/server";
import { decode } from "next-auth/jwt";
import { success, error } from "@/lib/api-response";
import { revokeRefreshTokensByDevice } from "@/lib/auth/jwt";
import { clearSession } from "@/lib/session-limiter";
import { JwtBlacklist } from "@/lib/jwt-blacklist";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const SESSION_COOKIE_NAME = "authjs.session-token";
const auditService = new AuditService(prisma);

export async function POST(req: NextRequest) {
  // 1. Validate AUTH_SECRET
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    logger.error("[mobile-logout] AUTH_SECRET not set");
    return error("ServerError", "伺服器設定錯誤", 500);
  }

  // 2. Extract and validate Bearer token
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return error("UnauthorizedError", "缺少存取權杖", 401);
  }
  const jwe = authHeader.slice(7).trim();
  if (!jwe) {
    return error("UnauthorizedError", "缺少存取權杖", 401);
  }

  let payload;
  try {
    payload = await decode({
      token: jwe,
      secret,
      salt: SESSION_COOKIE_NAME,
    });
  } catch {
    return error("UnauthorizedError", "無效的存取權杖", 401);
  }

  if (!payload || !payload.id) {
    return error("UnauthorizedError", "無效的存取權杖", 401);
  }

  // 3. Parse request body
  let body: { deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { deviceId } = body;
  if (!deviceId || typeof deviceId !== "string" || deviceId.length > 128) {
    return error("ValidationError", "無效的 deviceId", 400);
  }

  const userId = payload.id as string;
  const sessionId = payload.sessionId as string | undefined;
  const ip = getClientIp(req) ?? "unknown";

  // 4. Revoke refresh tokens for user+device
  await revokeRefreshTokensByDevice(userId, deviceId);

  // 5. Clear session from session limiter (platform=mobile for T1086 compat)
  if (sessionId) {
    await clearSession(userId, sessionId, "mobile");
  }

  // 6. Blacklist the JWT so it cannot be used within the 15-min window
  if (sessionId) {
    JwtBlacklist.add(`session:${sessionId}`);
  }

  // 7. Audit log
  auditService
    .log({
      userId,
      action: "MOBILE_LOGOUT",
      resourceType: "Auth",
      resourceId: userId,
      detail: JSON.stringify({ deviceId, sessionId }),
      ipAddress: ip,
    })
    .catch((err) => {
      logger.error({ err, userId }, "[mobile-logout] Audit log write failed");
    });

  logger.info({ userId, deviceId }, "[mobile-logout] Successful logout");

  return success({ ok: true });
}
