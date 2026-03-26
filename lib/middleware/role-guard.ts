/**
 * RBAC Role Guard helper — Issue #801 (AD-2)
 */

import { requireAuth, type AuthSession } from "@/lib/rbac";
import { ForbiddenError } from "@/services/errors";
import { hasMinimumRole, type RoleName } from "@/lib/auth/permissions";

export async function requireMinRole(minRole: RoleName): Promise<AuthSession> {
  const session = await requireAuth();
  if (!hasMinimumRole(session.user.role, minRole)) {
    throw new ForbiddenError("權限不足");
  }
  return session;
}

export async function requireAdmin(): Promise<AuthSession> {
  return requireMinRole("ADMIN");
}

export async function requireManagerOrAbove(): Promise<AuthSession> {
  return requireMinRole("MANAGER");
}

export function isAdmin(role: string): boolean {
  return role === "ADMIN";
}

export function isManagerOrAbove(role: string): boolean {
  return hasMinimumRole(role, "MANAGER");
}
