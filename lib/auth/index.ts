/**
 * Auth module barrel — lib/auth/
 *
 * Re-exports authentication-related modules for organized imports.
 * Existing imports (e.g., `@/lib/auth-middleware`) continue to work.
 * New code should prefer `@/lib/auth` for auth-related imports.
 *
 * Modules:
 * - auth-depth: Edge JWT/JWE verification
 * - auth-middleware: withAuth / withManager wrappers
 * - jwt-blacklist: server-side token revocation
 * - session-cache: cached session retrieval
 * - session-limiter: concurrent session enforcement
 * - password-expiry: password age tracking
 * - password-policy: password strength rules
 * - account-lock: failed login lockout
 * - rbac: role-based access control helpers
 */

export { withAuth, withManager } from "@/lib/auth-middleware";
export { JwtBlacklist } from "@/lib/jwt-blacklist";
export { getCachedSession } from "@/lib/session-cache";
export {
  registerSession,
  isSessionActive,
  clearSession,
  getActiveSessionCount,
} from "@/lib/session-limiter";
export { requireAuth } from "@/lib/rbac";
