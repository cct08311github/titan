/**
 * Security module barrel — lib/security/
 *
 * Re-exports security-related modules for organized imports.
 * Existing imports (e.g., `@/lib/csrf`) continue to work.
 * New code should prefer `@/lib/security` for security-related imports.
 *
 * Modules:
 * - csrf: CSRF origin validation
 * - rate-limiter: rate limiting factories + consume helper
 * - security-middleware: composable middleware chain (withRateLimit, withAuditLog, etc.)
 * - env-validator: startup env var validation
 */

export { validateCsrf, CsrfError } from "@/lib/csrf";
export {
  createLoginRateLimiter,
  createApiRateLimiter,
  checkRateLimit,
  RateLimitError,
} from "@/lib/rate-limiter";
export {
  withRateLimit,
  withAuditLog,
  withSessionTimeout,
  withJwtBlacklist,
} from "@/lib/security-middleware";
export { validateEnv } from "@/lib/env-validator";
