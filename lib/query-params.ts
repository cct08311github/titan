/**
 * Standardised query-parameter parsers for GET API routes.
 *
 * Each parser returns the validated number on success, or `undefined` when the
 * raw value is missing/empty.  If the raw value is present but invalid an
 * `InvalidParamError` is thrown – the caller (or a wrapping `withAuth` /
 * `api-handler`) converts it to a 422 JSON response.
 *
 * Usage:
 *   const year  = parseYear(searchParams.get("year"));   // number | undefined
 *   const page  = parsePage(searchParams.get("page"));   // number (>= 1, default 1)
 *   const limit = parseLimit(searchParams.get("limit")); // number (1-500, default 50)
 */

// ─── Error ────────────────────────────────────────────────────

export class InvalidParamError extends Error {
  public readonly param: string;
  public readonly value: string;

  constructor(param: string, value: string, hint: string) {
    super(`參數 ${param} 不合法：${hint}（收到 "${value}"）`);
    this.name = "InvalidParamError";
    this.param = param;
    this.value = value;
  }
}

// ─── Helpers ──────────────────────────────────────────────────

/** Parse raw string to integer; returns NaN for null/undefined/empty. */
function toInt(raw: string | null | undefined): number {
  if (raw == null || raw === "") return NaN;
  return parseInt(raw, 10);
}

// ─── Public parsers ───────────────────────────────────────────

/**
 * Parse a `year` query param.
 * Returns `fallback` (default: current year) when absent.
 * Throws `InvalidParamError` when present but outside 2000–2100.
 */
export function parseYear(
  raw: string | null | undefined,
  fallback: number = new Date().getFullYear(),
): number {
  if (raw == null || raw === "") return fallback;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) {
    throw new InvalidParamError("year", String(raw), "須為 2000-2100 之間的整數");
  }
  return n;
}

/**
 * Parse an optional `year` query param.
 * Returns `undefined` when absent (instead of falling back to current year).
 * Throws `InvalidParamError` when present but outside 2000–2100.
 */
export function parseYearOptional(
  raw: string | null | undefined,
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 2000 || n > 2100) {
    throw new InvalidParamError("year", String(raw), "須為 2000-2100 之間的整數");
  }
  return n;
}

/**
 * Parse a `month` query param (1–12).
 * Returns `undefined` when absent.
 * Throws `InvalidParamError` when present but outside 1–12.
 */
export function parseMonth(
  raw: string | null | undefined,
): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 1 || n > 12) {
    throw new InvalidParamError("month", String(raw), "須為 1-12 之間的整數");
  }
  return n;
}

/**
 * Parse a `quarter` query param (1–4).
 * Returns `fallback` (default 1) when absent.
 * Throws `InvalidParamError` when present but outside 1–4.
 */
export function parseQuarter(
  raw: string | null | undefined,
  fallback = 1,
): number {
  if (raw == null || raw === "") return fallback;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 1 || n > 4) {
    throw new InvalidParamError("quarter", String(raw), "須為 1-4 之間的整數");
  }
  return n;
}

/**
 * Parse a `page` query param (>= 1).
 * Returns `1` when absent.
 */
export function parsePage(raw: string | null | undefined): number {
  if (raw == null || raw === "") return 1;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 1) {
    throw new InvalidParamError("page", String(raw), "須為 >= 1 的整數");
  }
  return n;
}

/**
 * Parse a `limit` query param (1–`max`).
 * Returns `defaultVal` when absent.
 */
export function parseLimit(
  raw: string | null | undefined,
  defaultVal = 50,
  max = 500,
): number {
  if (raw == null || raw === "") return defaultVal;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 1 || n > max) {
    throw new InvalidParamError("limit", String(raw), `須為 1-${max} 之間的整數`);
  }
  return n;
}

/**
 * Parse an `offset` query param (>= 0).
 * Returns `0` when absent.
 */
export function parseOffset(
  raw: string | null | undefined,
): number {
  if (raw == null || raw === "") return 0;
  const n = toInt(raw);
  if (!Number.isFinite(n) || n < 0) {
    throw new InvalidParamError("offset", String(raw), "須為 >= 0 的整數");
  }
  return n;
}
