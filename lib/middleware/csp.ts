/**
 * CSP nonce middleware module — Issue #404 (extracted from middleware.ts)
 *
 * Generates a per-request nonce and builds the Content-Security-Policy header.
 * Originally introduced in Issue #190.
 */

import { NextResponse } from "next/server";

/** CSP nonce header name — must match between middleware and Server Components */
export const CSP_NONCE_HEADER = "x-csp-nonce";

/** Generate a cryptographically random nonce (base64-encoded, 16 bytes) */
export function generateNonce(): string {
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  return Buffer.from(nonceBytes).toString("base64");
}

/** Build a CSP header value with the given nonce */
export function buildCspWithNonce(nonce: string): string {
  const isDev = process.env.NODE_ENV === "development";
  // Both dev and prod use nonce. Dev additionally needs 'unsafe-eval' for HMR.
  const scriptSrc = isDev
    ? `script-src 'self' 'nonce-${nonce}' 'unsafe-eval'`  // Dev: nonce + unsafe-eval for HMR
    : `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`;
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self' wss: ws:",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'self'",
  ].join("; ");
}

/** Apply CSP nonce to both request headers and response headers */
export function applyCsp(
  reqHeaders: Headers,
  res: NextResponse,
  nonce: string
): void {
  reqHeaders.set(CSP_NONCE_HEADER, nonce);
  res.headers.set("Content-Security-Policy", buildCspWithNonce(nonce));
  res.headers.set(CSP_NONCE_HEADER, nonce);
}
