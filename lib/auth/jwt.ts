/**
 * JWT token management — Issue #795 (AU-1)
 *
 * Handles refresh token creation, rotation, and revocation.
 * Access tokens are managed by NextAuth's JWT strategy (15min TTL).
 * Refresh tokens are stored in DB with SHA-256 hash (7d TTL).
 */

import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Generate a cryptographically secure random token.
 */
function generateToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Hash a token with SHA-256 for storage.
 */
async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer), (b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Issue a new refresh token for a user.
 * Returns the raw token (to send to client) — only the hash is stored.
 *
 * @param userId - The user ID
 * @param deviceId - Optional mobile device ID for device binding (Issue #1085)
 */
export async function issueRefreshToken(userId: string, deviceId?: string): Promise<string> {
  const rawToken = generateToken();
  const tokenHash = await hashToken(rawToken);

  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash,
      deviceId: deviceId ?? null,
      expiresAt: new Date(Date.now() + REFRESH_TOKEN_TTL_MS),
    },
  });

  return rawToken;
}

/**
 * Rotate a refresh token: validate the old one, revoke it, issue a new one.
 * Returns { userId, newToken } on success, null on failure.
 *
 * Implements refresh token rotation: each token is single-use.
 *
 * @param oldRawToken - The raw refresh token to rotate
 * @param deviceId - Optional device ID for mobile device binding verification (Issue #1085).
 *                   If provided, the token must have been issued to the same device.
 */
export async function rotateRefreshToken(
  oldRawToken: string,
  deviceId?: string,
): Promise<{ userId: string; newToken: string } | null> {
  const tokenHash = await hashToken(oldRawToken);

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash },
  });

  if (!existing) {
    logger.warn("[jwt] Refresh token not found — possible replay attack");
    return null;
  }

  if (existing.revokedAt) {
    // Token reuse detected — revoke ALL tokens for this user (security measure)
    logger.warn(
      { userId: existing.userId },
      "[jwt] Revoked refresh token reused — revoking all user tokens"
    );
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  if (existing.expiresAt < new Date()) {
    logger.warn("[jwt] Refresh token expired");
    return null;
  }

  // Issue #1085: Device binding verification — stolen token cannot be used on another device
  // [CR #4] If token was issued to a device (existing.deviceId set), caller MUST provide
  // matching deviceId. Missing deviceId on a device-bound token = reject (prevents bypass).
  if (existing.deviceId && (!deviceId || existing.deviceId !== deviceId)) {
    logger.warn(
      { userId: existing.userId, expected: existing.deviceId, actual: deviceId },
      "[jwt] Refresh token device mismatch — possible stolen token"
    );
    // Revoke ALL tokens for this user as a precaution
    await prisma.refreshToken.updateMany({
      where: { userId: existing.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return null;
  }

  // Revoke the old token
  await prisma.refreshToken.update({
    where: { id: existing.id },
    data: { revokedAt: new Date() },
  });

  // Issue a new one (inherit deviceId from the old token)
  const newToken = await issueRefreshToken(existing.userId, existing.deviceId ?? deviceId);

  return { userId: existing.userId, newToken };
}

/**
 * Revoke all refresh tokens for a user (on logout or password change).
 */
export async function revokeAllRefreshTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/**
 * Revoke a single refresh token (on logout with specific token).
 */
export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const tokenHash = await hashToken(rawToken);
  await prisma.refreshToken.updateMany({
    where: { tokenHash, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}
