/**
 * DELETE /api/push/unregister — Issue #1101
 *
 * Unregister a device's push token (logout or device reset).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { requireAuth } from "@/lib/rbac";
import { logger } from "@/lib/logger";

export async function DELETE(req: NextRequest) {
  const session = await requireAuth();

  const deviceId = req.nextUrl.searchParams.get("deviceId");

  if (!deviceId || typeof deviceId !== "string") {
    return error("ValidationError", "缺少或無效的 deviceId", 400);
  }

  try {
    const result = await prisma.pushToken.deleteMany({
      where: {
        deviceId,
        userId: session.user.id,
      },
    });

    logger.info({ userId: session.user.id, deviceId, deleted: result.count }, "[push] Token unregistered");

    return success({ ok: true, deleted: result.count });
  } catch (err) {
    logger.error({ err, userId: session.user.id }, "[push] Failed to unregister token");
    return error("ServerError", "移除推播 Token 失敗", 500);
  }
}
