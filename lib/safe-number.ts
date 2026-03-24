/**
 * Safe number utilities — Issue #175
 *
 * Prevents runtime crashes from calling .toFixed(), .toLocaleString(),
 * or other Number methods on null/undefined/NaN values.
 *
 * All frontend pages must use these utilities instead of raw Number methods.
 */

/**
 * Safely format a number with fixed decimal places.
 * Returns fallback string for null, undefined, NaN, Infinity, or non-number values.
 */
export function safeFixed(value: unknown, digits = 1, fallback = "0"): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toFixed(digits);
  }
  return fallback;
}

/**
 * Safely format a number with locale string.
 * Returns fallback string for non-finite values.
 */
export function safeLocaleString(
  value: unknown,
  locale = "zh-TW",
  options?: Intl.NumberFormatOptions,
  fallback = "0"
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value.toLocaleString(locale, options);
  }
  return fallback;
}

/**
 * Safely convert unknown value to a finite number.
 * Returns fallback for null, undefined, NaN, Infinity, or non-numeric strings.
 */
export function safeNum(value: unknown, fallback = 0): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Safely format a percentage value.
 * Clamps to 0-100 range unless allowOverflow is true.
 */
export function safePct(
  value: unknown,
  digits = 0,
  fallback = "0",
  allowOverflow = false
): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    const clamped = allowOverflow ? value : Math.max(0, Math.min(100, value));
    return clamped.toFixed(digits);
  }
  return fallback;
}
