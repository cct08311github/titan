/**
 * Password expiry checking — Issue #182
 *
 * 銀行政策：密碼 90 天到期，首次登入強制變更。
 */

/** Password expires after this many days. */
export const PASSWORD_MAX_AGE_DAYS = 90;

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
