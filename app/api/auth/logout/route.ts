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
  }

  return success({ message: "已登出" });
}
