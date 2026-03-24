/**
 * CSRF protection middleware — Issue #125
 *
 * Strategy: Origin header validation (same-origin check).
 *
 * Rules:
 *  1. Safe HTTP methods (GET, HEAD, OPTIONS) are always allowed — they must
 *     not mutate state and are not CSRF-eligible.
 *  2. NextAuth's own routes (/api/auth/*) are excluded — NextAuth manages its
 *     own csrfToken cookie internally.
 *  3. If the Origin header is absent we allow the request: server-to-server
 *     calls and same-origin form posts from older browsers don't send Origin.
 *     A browser CSRF attack from a foreign page will always include Origin.
 *  4. If Origin is present it must match the Host header (same-origin). A
 *     mismatch throws CsrfError (→ 403).
 *
 * Cookie hardening (SameSite=Strict) is applied via NextAuth authOptions in
 * app/api/auth/[...nextauth]/route.ts.
 */

import type { NextRequest } from "next/server";

/** HTTP methods that do not mutate state — exempt from CSRF checks. */
const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/** URL prefix handled by NextAuth — has its own csrfToken mechanism. */
const NEXTAUTH_PREFIX = "/api/auth/";

/**
 * Typed error thrown when CSRF validation fails.
 * apiHandler maps this to a 403 ForbiddenError response.
 */
export class CsrfError extends Error {
  readonly statusCode = 403;

  constructor(message = "CSRF 驗證失敗") {
    super(message);
    this.name = "CsrfError";
    // Maintain correct prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Validates the incoming request against CSRF attacks.
 *
 * Throws CsrfError (403) for state-mutating cross-origin requests.
 * Returns void on success (no-throw = pass).
 */
export function validateCsrf(req: NextRequest): void {
  const { method, url, headers } = req;

  // 1. Safe methods are never CSRF-vulnerable
  if (SAFE_METHODS.has(method.toUpperCase())) {
    return;
  }

  // 2. NextAuth manages its own CSRF — skip our check for /api/auth/*
  const pathname = new URL(url).pathname;
  if (pathname.startsWith(NEXTAUTH_PREFIX)) {
    return;
  }

  // 3. If Origin header is absent, allow (non-browser / same-origin fallback)
  const origin = headers.get("origin");
  if (!origin) {
    return;
  }

  // 4. Compare Origin against Host — must match to be same-origin
  const host = headers.get("host");
  if (!host) {
    // No Host header — can't validate, but Origin is present and we can't
    // confirm legitimacy. Block to be safe.
    throw new CsrfError("CSRF 驗證失敗：無法確認請求來源");
  }

  // Extract the host portion from the Origin URL (strips scheme + trailing slash)
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new CsrfError("CSRF 驗證失敗：Origin 格式無效");
  }

  if (originHost !== host) {
    throw new CsrfError(`CSRF 驗證失敗：Origin "${originHost}" 與 Host "${host}" 不符`);
  }
}
