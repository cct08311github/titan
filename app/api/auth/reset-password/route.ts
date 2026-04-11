/**
 * POST /api/auth/reset-password — Issue #267
 *
 * User submits OTP + new password to reset their password.
 * Does NOT require an existing session (user may be locked out).
 *
 * Flow:
 *   1. Rate limit by IP (prevents brute-force OTP guessing)
 *   2. User enters email + OTP + new password
 *   3. Server validates OTP, checks expiry
 *   4. Password updated, OTP marked as used, mustChangePassword cleared
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { hash } from "bcryptjs";
import { createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { isPasswordValid, PASSWORD_POLICY_DESCRIPTION } from "@/lib/password-policy";
import { AuditService } from "@/services/audit-service";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/lib/get-client-ip";
import { createLoginRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { apiHandler } from "@/lib/api-handler";
import { validateBody } from "@/lib/validate";

const resetPasswordSchema = z.object({
  email: z.string().min(1),
  token: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

const auditService = new AuditService(prisma);

// Rate limit password-reset attempts per IP to prevent OTP brute-force.
// 5 attempts per 5 minutes is aggressive but reasonable for a bank platform.
const resetRateLimiter = createLoginRateLimiter({
  points: 5,
  duration: 300,
});

// Wrapped in apiHandler so CSRF validator runs (Round 7: custom
// /api/auth/* routes are no longer blanket-exempted from CSRF).
export const POST = apiHandler(async (req: NextRequest) => {
  const ip = getClientIp(req);

  // Rate limit by IP before any DB work. Same skip rule as mobile login (#1214).
  if (process.env.NODE_ENV !== "test") {
    try {
      await checkRateLimit(resetRateLimiter, ip || "unknown");
    } catch {
      logger.warn({ ip, event: "password_reset_rate_limited" }, "Password reset rate limit exceeded");
      return error("RateLimitError", "嘗試過於頻繁，請稍後再試", 429);
    }
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  const { email: rawEmail, token, newPassword } = validateBody(resetPasswordSchema, rawBody);

  // Normalize email to lowercase (consistent with login — see auth.ts)
  const email = rawEmail.toLowerCase().trim();

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

  // Hash submitted token before querying — tokens are stored as SHA-256 hashes
  const tokenHash = createHash("sha256").update(token).digest("hex");

  // Find valid, unused token
  const resetToken = await prisma.passwordResetToken.findFirst({
    where: {
      userId: user.id,
      token: tokenHash,   // Compare by hash
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

  // Audit log (ip already captured at top of handler)
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
});
