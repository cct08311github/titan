/**
 * RBAC permission middleware — Issue #81
 *
 * Provides API-layer permission helpers that throw typed errors caught by
 * apiHandler. All functions require an active next-auth session.
 *
 * Roles (from Prisma schema):
 *   MANAGER — full access to all resources, team data, and mutations
 *   ENGINEER — read own data; elevated access via Permission table
 *
 * PermissionScope values:
 *   VIEW_TEAM — access all team members' data
 *   VIEW_OWN  — access only own data (default for ENGINEER)
 */

import { getServerSession } from "next-auth";
import { UnauthorizedError, ForbiddenError } from "@/services/errors";
import { prisma } from "@/lib/prisma";

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
 * Asserts an active session exists.
 * Throws UnauthorizedError (→ 401) if not authenticated.
 */
export async function requireAuth(): Promise<AuthSession> {
  const session = await getServerSession();
  if (!session || !session.user) {
    throw new UnauthorizedError("未授權");
  }
  return session as AuthSession;
}

/**
 * Asserts session exists AND user has the required role.
 * Throws UnauthorizedError (→ 401) if not authenticated.
 * Throws ForbiddenError (→ 403) if authenticated but wrong role.
 */
export async function requireRole(role: string): Promise<AuthSession> {
  const session = await requireAuth();
  if (session.user.role !== role) {
    throw new ForbiddenError("權限不足");
  }
  return session;
}

/**
 * Asserts session exists AND (user owns the resource OR user is MANAGER).
 * Throws UnauthorizedError (→ 401) if not authenticated.
 * Throws ForbiddenError (→ 403) if ENGINEER accessing another user's resource.
 */
export async function requireOwnerOrManager(resourceOwnerId: string): Promise<AuthSession> {
  const session = await requireAuth();
  const { id, role } = session.user;

  if (role === "MANAGER") {
    return session;
  }

  if (id === resourceOwnerId) {
    return session;
  }

  throw new ForbiddenError("權限不足：僅限資源擁有者或管理員");
}

/**
 * Checks whether `userId` has `scope` access.
 *
 * Rules:
 *   - MANAGER always has VIEW_TEAM and VIEW_OWN
 *   - ENGINEER always has VIEW_OWN for their own userId (session.user.id === userId)
 *   - ENGINEER has VIEW_TEAM only if an active Permission row exists
 *   - Expired permissions (expiresAt < now) are excluded via the DB query
 *
 * Returns true/false without throwing — callers decide how to respond.
 */
export async function checkPermission(userId: string, scope: PermissionScope): Promise<boolean> {
  const session = await getServerSession();
  if (!session || !session.user) {
    return false;
  }

  const currentUser = session.user as SessionUser;

  // MANAGER has unrestricted access
  if (currentUser.role === "MANAGER") {
    return true;
  }

  // VIEW_OWN: ENGINEER can only see their own data
  if (scope === "VIEW_OWN") {
    return currentUser.id === userId;
  }

  // VIEW_TEAM: check Permission table for an active, non-expired grant
  if (scope === "VIEW_TEAM") {
    const permission = await prisma.permission.findFirst({
      where: {
        granteeId: currentUser.id,
        permType: "VIEW_TEAM",
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });
    return permission !== null;
  }

  return false;
}
