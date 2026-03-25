/**
 * POST /api/auth/reset-password — Issue #267
 *
 * User submits OTP + new password to reset their password.
 * Does NOT require an existing session (user may be locked out).
 *
 * Flow:
 *   1. User enters email + OTP + new password
 *   2. Server validates OTP, checks expiry
 *   3. Password updated, OTP marked as used, mustChangePassword cleared
 *
 * Rate-limited by the global rate limiter in middleware.ts.
 */
import { NextRequest } from "next/server";
import { hash } from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { isPasswordValid, PASSWORD_POLICY_DESCRIPTION } from "@/lib/password-policy";
import { AuditService } from "@/services/audit-service";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/get-client-ip";

const auditService = new AuditService(prisma);

export async function POST(req: NextRequest) {
  let body: { email?: string; token?: string; newPassword?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { email, token, newPassword } = body;

  if (!email || !token || !newPassword) {
    return error("ValidationError", "請填寫 email、重設碼與新密碼", 400);
  }

  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, isActive: true },
  });

  if (!user) {
    // Return generic error to prevent email enumeration
    return error("InvalidTokenError", "重設碼無效或已過期", 400);
  }

  if (!user.isActive) {
    return error("InvalidTokenError", "重設碼無效或已過期", 400);
  }

  // Find valid, unused token
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      token,
      usedAt: null,
      expiresAt: { gt: new Date() },
    },
  });

  if (!resetToken) {
    logger.warn({
      event: "password_reset_invalid_token",
      email,
      ip: getClientIp(req),
    });
    return error("InvalidTokenError", "重設碼無效或已過期", 400);
  }

  // Validate new password against policy
  const passwordCheck = isPasswordValid(newPassword);
  if (!passwordCheck) {
    return error("ValidationError", PASSWORD_POLICY_DESCRIPTION, 400);
  }

  // Hash new password and update
  const hashedPassword = await hash(newPassword, 12);

  await prisma.$transaction([
    // Update password
    prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    }),
    // Mark token as used
    prisma.passwordResetToken.update({
      where: { id: resetToken.id },
      data: { usedAt: new Date() },
    }),
    // Add to password history
    prisma.passwordHistory.create({
      data: {
        userId: user.id,
        hash: hashedPassword,
      },
    }),
  ]);

  // Audit log
  const ip = getClientIp(req);
  await auditService.log({
    action: "PASSWORD_RESET_COMPLETED",
    userId: user.id,
    targetId: user.id,
    targetType: "User",
    details: `使用者 ${user.name} 透過 OTP 完成密碼重設`,
    ipAddress: ip,
  });

  logger.info({
    event: "password_reset_completed",
    userId: user.id,
  });

  return success({ message: "密碼已成功重設，請使用新密碼登入" });
}
