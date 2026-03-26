/**
 * POST /api/admin/unlock — Issue #797 (AU-3)
 *
 * Admin manually unlocks a locked account.
 * Only MANAGER or above can access this endpoint.
 */

import { NextRequest } from "next/server";
import { success, error } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { AccountLockService } from "@/lib/account-lock";
import { AuditService } from "@/services/audit-service";
import { prisma } from "@/lib/prisma";
import { getRedisClient } from "@/lib/redis";
import { getClientIp } from "@/lib/get-client-ip";

const redis = getRedisClient();
const accountLockService = new AccountLockService({
  maxFailures: 5,
  lockDurationSeconds: 1800,
  redisClient: redis,
});
const auditService = new AuditService(prisma);

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireRole("MANAGER");

  let body: { userId?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { userId, email } = body;
  if (!userId && !email) {
    return error("ValidationError", "請提供 userId 或 email", 400);
  }

  // Determine the lock key (email is used as key in auth.ts)
  let lockKey = email;
  if (!lockKey && userId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });
    if (!user) {
      return error("NotFoundError", "使用者不存在", 404);
    }
    lockKey = user.email;
  }

  if (!lockKey) {
    return error("ValidationError", "無法確定帳號", 400);
  }

  // Check if account is actually locked
  const isLocked = await accountLockService.isLocked(lockKey);
  if (!isLocked) {
    return success({ message: "帳號未被鎖定", unlocked: false });
  }

  // Unlock
  await accountLockService.resetFailures(lockKey);

  // Audit log
  await auditService.log({
    userId: session.user.id,
    action: "ACCOUNT_UNLOCK",
    resourceType: "User",
    resourceId: userId ?? null,
    detail: JSON.stringify({ email: lockKey, unlockedBy: session.user.id }),
    ipAddress: getClientIp(req),
  });

  return success({ message: "帳號已解鎖", unlocked: true });
});
