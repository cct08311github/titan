/**
 * Role → Permission mapping — Issue #801 (AD-2: Three-role RBAC)
 *
 * Simple three-role model:
 *   - ADMIN:    全系統管理
 *   - MANAGER:  團隊管理
 *   - ENGINEER: 個人操作
 */

export const ROLE_HIERARCHY = {
  ADMIN: 3,
  MANAGER: 2,
  ENGINEER: 1,
} as const;

export type RoleName = keyof typeof ROLE_HIERARCHY;

export function hasMinimumRole(userRole: string, requiredRole: RoleName): boolean {
  const userLevel = ROLE_HIERARCHY[userRole as RoleName] ?? 0;
  const requiredLevel = ROLE_HIERARCHY[requiredRole];
  return userLevel >= requiredLevel;
}

export const ROUTE_PERMISSIONS: Array<{
  pattern: RegExp;
  method?: string;
  minRole: RoleName;
}> = [
  { pattern: /^\/api\/admin\//, minRole: "ADMIN" },
  { pattern: /^\/api\/users$/, method: "POST", minRole: "MANAGER" },
  { pattern: /^\/api\/users\/[^/]+$/, method: "PUT", minRole: "MANAGER" },
  { pattern: /^\/api\/users\/[^/]+$/, method: "DELETE", minRole: "MANAGER" },
  { pattern: /^\/api\/reports\//, minRole: "MANAGER" },
];

export function getRequiredRole(pathname: string, method: string): RoleName {
  for (const rule of ROUTE_PERMISSIONS) {
    if (rule.pattern.test(pathname)) {
      if (!rule.method || rule.method === method.toUpperCase()) {
        return rule.minRole;
      }
    }
  }
  return "ENGINEER";
}
