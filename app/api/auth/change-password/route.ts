/**
 * POST /api/auth/change-password — Issue #182
 *
 * Allows authenticated users to change their password.
 * Validates against the password policy (Issue #180).
 * Updates passwordChangedAt and clears mustChangePassword.
 */
import { NextRequest } from "next/server";
import { compare, hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCachedSession } from "@/lib/session-cache";
import { success, error } from "@/lib/api-response";
import { isPasswordValid, PASSWORD_POLICY_DESCRIPTION } from "@/lib/password-policy";
import { AuditService } from "@/services/audit-service";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/get-client-ip";

const auditService = new AuditService(prisma);

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const session = await getCachedSession(req) as any;
  const userId = session?.user?.id as string | undefined;

  if (!userId) {
    return error("UnauthorizedError", "請先登入", 401);
  }

  let body: { currentPassword?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { currentPassword, newPassword } = body;

  if (!currentPassword || !newPassword) {
    return error("ValidationError", "請填寫目前密碼與新密碼", 400);
  }

  if (currentPassword === newPassword) {
    return error("ValidationError", "新密碼不得與目前密碼相同", 400);
  }

  // Validate new password against policy
  if (!isPasswordValid(newPassword)) {
    return error("ValidationError", PASSWORD_POLICY_DESCRIPTION, 400);
  }

  // Verify current password
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return error("NotFoundError", "使用者不存在", 404);
  }

  const isCurrentValid = await compare(currentPassword, user.password);
  if (!isCurrentValid) {
    return error("ValidationError", "目前密碼不正確", 400);
  }

  // Check password history — reject if new password matches any of the last 5 (Issue #201)
  const PASSWORD_HISTORY_LIMIT = 5;
  const recentHashes = await prisma.passwordHistory.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: PASSWORD_HISTORY_LIMIT,
    select: { hash: true },
  });

  for (const entry of recentHashes) {
    if (await compare(newPassword, entry.hash)) {
      return error("ValidationError", `新密碼不得與最近 ${PASSWORD_HISTORY_LIMIT} 組密碼相同`, 400);
    }
  }

  // Update password and save old hash to history
  const newHash = await hash(newPassword, 12);
  await prisma.$transaction([
    prisma.passwordHistory.create({
      data: { userId, hash: user.password },
    }),
    prisma.user.update({
      where: { id: userId },
      data: {
        password: newHash,
        passwordChangedAt: new Date(),
        mustChangePassword: false,
      },
    }),
  ]);

  // Audit log — never log password values
  await auditService.log({
    userId,
    action: "PASSWORD_CHANGE",
    resourceType: "User",
    resourceId: userId,
    detail: "Password changed by user (policy compliance)",
    ipAddress: getClientIp(req),
  });

  logger.info({ userId }, "[auth] Password changed successfully");

  return success({ message: "密碼變更成功" });
}
