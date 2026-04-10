/**
 * POST /api/push/register — Issue #1101
 *
 * Register an Expo push token for a mobile device.
 * Replaces any existing token for the same deviceId (token rotation).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { logger } from "@/lib/logger";

// withAuth adds CSRF + rate limit + password-expiry enforcement
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  let body: { token?: string; platform?: string; deviceId?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { token, platform, deviceId } = body;

  if (!token || typeof token !== "string") {
    return error("ValidationError", "缺少或無效的 push token", 400);
  }
  if (!deviceId || typeof deviceId !== "string") {
    return error("ValidationError", "缺少或無效的 deviceId", 400);
  }
  if (!platform || !["IOS", "ANDROID"].includes(platform)) {
    return error("ValidationError", "platform 必須是 IOS 或 ANDROID", 400);
  }

  try {
    // Upsert: update existing token or create new one
    await prisma.pushToken.upsert({
      where: { deviceId },
      create: {
        token,
        platform: platform as "IOS" | "ANDROID",
        deviceId,
        userId: session.user.id,
      },
      update: {
        token,
        platform: platform as "IOS" | "ANDROID",
        isActive: true,
      },
    });

    logger.info({ userId: session.user.id, deviceId, platform }, "[push] Token registered");

    return success({ ok: true });
  } catch (err) {
    logger.error({ err, userId: session.user.id }, "[push] Failed to register token");
    return error("ServerError", "儲存推播 Token 失敗", 500);
  }
});
