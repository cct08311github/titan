/**
 * Utils module barrel — lib/utils/
 *
 * Re-exports utility modules for organized imports.
 * Existing imports (e.g., `@/lib/safe-number`) continue to work.
 * New code should prefer `@/lib/utils` for utility imports.
 *
 * Modules:
 * - safe-number: safeFixed, safePct, safeNum
 * - format: date/number formatting helpers
 * - pagination: cursor/offset pagination helpers
 * - get-client-ip: client IP extraction from headers
 */

export { safeFixed, safePct, safeNum } from "@/lib/safe-number";
export { getClientIp } from "@/lib/get-client-ip";
