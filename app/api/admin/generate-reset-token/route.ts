/**
 * POST /api/admin/generate-reset-token — Issue #267
 *
 * Manager generates a one-time password reset token (OTP) for a user.
 * Designed for air-gapped environments where email delivery is unavailable.
 *
 * Flow:
 *   1. Manager requests OTP for target user
 *   2. Manager delivers OTP to user via secure channel (in-person, internal chat)
 *   3. User enters OTP at /login/reset-password page
 *
 * Authorization: MANAGER only
 */
import { NextRequest } from "next/server";
import { randomBytes, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { AuditService } from "@/services/audit-service";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/get-client-ip";

const TOKEN_EXPIRY_MINUTES = 30;
const auditService = new AuditService(prisma);

function generateOTP(): string {
  // Cryptographically secure 32-byte hex token (256 bits of entropy)
  return randomBytes(32).toString("hex");
}

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();
  const adminId = (session.user as { id: string }).id;

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  if (!body.userId) {
    return error("ValidationError", "請提供 userId", 400);
  }

  // Verify target user exists
  const targetUser = await prisma.user.findUnique({
    where: { id: body.userId },
    select: { id: true, name: true, email: true, isActive: true },
  });

  if (!targetUser) {
    return error("NotFoundError", "找不到指定使用者", 404);
  }

  if (!targetUser.isActive) {
    return error("ValidationError", "該使用者已停用", 400);
  }

  // Invalidate any existing unused tokens for this user
  await prisma.passwordResetToken.updateMany({
    where: { userId: body.userId, usedAt: null },
    data: { usedAt: new Date() }, // mark as used to invalidate
  });

  // Generate new OTP
  const token = generateOTP();
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_MINUTES * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: {
      userId: body.userId,
      token: tokenHash,   // Store hash, not plaintext
      expiresAt,
      createdBy: adminId,
    },
  });

  // Audit log
  const ip = getClientIp(req);
  await auditService.log({
    action: "PASSWORD_RESET_TOKEN_GENERATED",
    userId: adminId,
    targetId: body.userId,
    targetType: "User",
    details: `管理員為 ${targetUser.name} 產生密碼重設 OTP`,
    ipAddress: ip,
  });

  logger.info({
    event: "password_reset_token_generated",
    adminId,
    targetUserId: body.userId,
    expiresAt: expiresAt.toISOString(),
  });

  return success({
    token,
    expiresAt: expiresAt.toISOString(),
    expiresInMinutes: TOKEN_EXPIRY_MINUTES,
    userName: targetUser.name,
  });
});
