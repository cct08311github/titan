/**
 * Password expiry checking — Issue #182, enhanced Issue #834 (AU-5)
 *
 * 銀行政策：密碼預設 90 天到期，首次登入強制變更。
 * Admin 可透過環境變數 PASSWORD_MAX_AGE_DAYS 調整到期天數。
 */

/** Password expires after this many days (configurable via env, default 90). */
export const PASSWORD_MAX_AGE_DAYS = parseInt(
  process.env.PASSWORD_MAX_AGE_DAYS ?? "90",
  10,
) || 90;

/** Days before expiry to start showing warning (Issue #834). */
export const PASSWORD_WARN_DAYS = 7;

/**
 * Returns true if the password has expired (older than PASSWORD_MAX_AGE_DAYS).
 */
export function isPasswordExpired(passwordChangedAt: Date | null): boolean {
  if (!passwordChangedAt) return true;
  const now = Date.now();
  const changedMs = passwordChangedAt.getTime();
  const maxAgeMs = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  return now - changedMs > maxAgeMs;
}

/**
 * Returns how many days until password expires (0 if already expired).
 */
export function daysUntilExpiry(passwordChangedAt: Date | null): number {
  if (!passwordChangedAt) return 0;
  const maxAgeMs = PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
  const expiresAt = passwordChangedAt.getTime() + maxAgeMs;
  const remaining = expiresAt - Date.now();
  return remaining > 0 ? Math.ceil(remaining / (24 * 60 * 60 * 1000)) : 0;
}
