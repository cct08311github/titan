/**
 * Auth module barrel — lib/auth/
 */

export { withAuth, withManager, withAdmin } from "@/lib/auth-middleware";
export { JwtBlacklist } from "@/lib/jwt-blacklist";
export { getCachedSession } from "@/lib/session-cache";
export {
  registerSession,
  isSessionActive,
  clearSession,
  getActiveSessionCount,
} from "@/lib/session-limiter";
export { requireAuth, requireMinRole, requireRole } from "@/lib/rbac";
export { hasMinimumRole, type RoleName } from "@/lib/auth/permissions";
export { requireAdmin, requireManagerOrAbove, isAdmin, isManagerOrAbove } from "@/lib/middleware/role-guard";
