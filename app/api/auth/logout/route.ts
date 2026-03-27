/**
 * POST /api/auth/logout — Issue #795 (AU-1)
 *
 * Revokes the refresh token and clears the session.
 * Works alongside NextAuth's signOut for full session cleanup.
 */

import { NextRequest } from "next/server";
import { success, error } from "@/lib/api-response";
import { revokeRefreshToken, revokeAllRefreshTokens } from "@/lib/auth/jwt";
import { auth } from "@/auth";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { AuditService } from "@/services/audit-service";

export async function POST(req: NextRequest) {
  let body: { refreshToken?: string } = {};
  try {
    body = await req.json();
  } catch {
    // Body is optional — logout without refresh token still works
  }

  const session = await auth();
  const userId = (session?.user as { id?: string })?.id;

  if (body.refreshToken) {
    // Revoke specific refresh token
    await revokeRefreshToken(body.refreshToken);
  } else if (userId) {
    // Revoke all refresh tokens for the user
    await revokeAllRefreshTokens(userId);
  }

  if (userId) {
    logger.info({ userId }, "[auth] User logged out");

    // Banking compliance: audit trail for logout events
    const auditService = new AuditService(prisma);
    auditService.log({
      userId,
      action: "LOGOUT",
      module: "AUTH",
      resourceType: "Session",
      detail: "User logged out",
      ipAddress:
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        req.headers.get("x-real-ip") ||
        null,
    }).catch((err) => {
      logger.error({ err, userId }, "[auth] Audit log write failed for logout");
    });
  }

  return success({ message: "已登出" });
}
