/**
 * POST /api/auth/refresh — Issue #795 (AU-1)
 *
 * Exchange a refresh token for a new token pair.
 * Implements refresh token rotation (old token immediately invalidated).
 */

import { NextRequest } from "next/server";
import { success, error } from "@/lib/api-response";
import { rotateRefreshToken } from "@/lib/auth/jwt";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function POST(req: NextRequest) {
  let body: { refreshToken?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { refreshToken } = body;
  if (!refreshToken) {
    return error("ValidationError", "缺少 refresh token", 400);
  }

  const result = await rotateRefreshToken(refreshToken);
  if (!result) {
    return error("UnauthorizedError", "Refresh token 無效或已過期", 401);
  }

  // Fetch user for token payload
  const user = await prisma.user.findUnique({
    where: { id: result.userId },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  if (!user || !user.isActive) {
    return error("UnauthorizedError", "帳號已停用", 401);
  }

  logger.info({ userId: user.id }, "[auth] Token refreshed successfully");

  return success({
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    refreshToken: result.newToken,
    expiresIn: 15 * 60, // 15 minutes (access token TTL)
  });
}
