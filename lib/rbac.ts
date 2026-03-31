/**
 * RBAC permission middleware — Issue #81, enhanced Issue #801 (AD-2)
 *
 * Three-role hierarchy: ADMIN > MANAGER > ENGINEER
 */

import { auth } from "@/auth";
import { decode } from "next-auth/jwt";
import { headers } from "next/headers";
import { UnauthorizedError, ForbiddenError } from "@/services/errors";
import { prisma } from "@/lib/prisma";
import { hasMinimumRole, type RoleName } from "@/lib/auth/permissions";
import { JwtBlacklist } from "@/lib/jwt-blacklist";

export type PermissionScope = "VIEW_TEAM" | "VIEW_OWN";

export interface SessionUser {
  id: string;
  name?: string | null;
  email?: string | null;
  image?: string | null;
  role: string;
}

export interface AuthSession {
  user: SessionUser;
  expires: string;
}

/**
 * Authenticate via cookie (web) or Bearer token (mobile).
 *
 * Checks Bearer header first to avoid running auth() (which attempts
 * HKDF key derivation) on mobile requests where cookies are absent.
 *
 * [SA C-4]: Mobile path includes JwtBlacklist check to prevent
 * revoked sessions from accessing API within the 15-min JWT window.
 *
 * Issue #1085: Mobile auth support
 */
export async function requireAuth(): Promise<AuthSession> {
  // 1. Check for Bearer token (mobile clients)
  const headerStore = await headers();
  const authHeader = headerStore.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return verifyMobileToken(authHeader.slice(7).trim());
  }

  // 2. Fallback to NextAuth session (web clients)
  const session = await auth();
  if (!session || !session.user) {
    throw new UnauthorizedError("未授權");
  }
  return session as AuthSession;
}

/**
 * Verify a mobile JWE access token produced by Auth.js encode().
 * Includes blacklist check for revoked sessions.
 */
async function verifyMobileToken(jwe: string): Promise<AuthSession> {
  const secret = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new UnauthorizedError("伺服器設定錯誤");
  }

  // [CR #1] Wrap decode() in try-catch — crypto errors should return 401, not 500
  let payload;
  try {
    payload = await decode({
      token: jwe,
      secret,
      salt: "authjs.session-token",
    });
  } catch {
    throw new UnauthorizedError("無效的存取權杖");
  }

  // [CR #5] Validate required fields — tampered tokens may be missing role/id
  if (!payload || !payload.id || !payload.role) {
    throw new UnauthorizedError("無效的存取權杖");
  }

  // [SA C-4] Check if session has been revoked via blacklist
  const sessionId = payload.sessionId as string | undefined;
  if (sessionId && await JwtBlacklist.has(`session:${sessionId}`)) {
    throw new UnauthorizedError("Session 已撤銷");
  }

  return {
    user: {
      id: payload.id as string,
      name: (payload.name as string) ?? null,
      email: (payload.email as string) ?? null,
      role: payload.role as string,
    },
    expires: payload.exp
      ? new Date(Number(payload.exp) * 1000).toISOString()
      : new Date(Date.now() + 15 * 60 * 1000).toISOString(),
  };
}

export async function requireRole(role: string): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.user.role === "ADMIN") return session;
  if (session.user.role !== role) {
    throw new ForbiddenError("權限不足");
  }
  return session;
}

export async function requireMinRole(minRole: RoleName): Promise<AuthSession> {
  const session = await requireAuth();
  if (!hasMinimumRole(session.user.role, minRole)) {
    throw new ForbiddenError("權限不足");
  }
  return session;
}

export async function requireOwnerOrManager(resourceOwnerId: string): Promise<AuthSession> {
  const session = await requireAuth();
  const { id, role } = session.user;
  if (hasMinimumRole(role, "MANAGER")) return session;
  if (id === resourceOwnerId) return session;
  throw new ForbiddenError("權限不足：僅限資源擁有者或管理員");
}

export async function checkPermission(userId: string, scope: PermissionScope): Promise<boolean> {
  const session = await auth();
  if (!session || !session.user) return false;
  const currentUser = session.user as SessionUser;
  if (hasMinimumRole(currentUser.role, "MANAGER")) return true;
  if (scope === "VIEW_OWN") return currentUser.id === userId;
  if (scope === "VIEW_TEAM") {
    const permission = await prisma.permission.findFirst({
      where: {
        granteeId: currentUser.id,
        permType: "VIEW_TEAM",
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return permission !== null;
  }
  return false;
}
