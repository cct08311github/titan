/**
 * Next.js Edge Middleware — Auth + CSP Nonce + Correlation ID (Issue #129, #190, #199)
 *
 * Layer 1 (this file, Edge runtime): JWT verification + CSP nonce + request ID injection.
 *   - Applies to all /api/* routes except /api/auth/*
 *   - Uses AUTH_SECRET (or NEXTAUTH_SECRET) to verify the JWT signature and expiry
 *   - Blocks unauthenticated, expired, or tampered tokens with HTTP 401
 *   - Logs every blocked request via the structured logger
 *   - 生成每請求唯一 nonce，寫入 Content-Security-Policy 與 x-csp-nonce header
 *
 * Layer 2 (route handlers, Node.js runtime): full DB session check.
 *   - withAuth / withManager wrappers are kept on ALL route handlers (not removed)
 *   - getServerSession() re-validates the session against the database on every call
 *
 * Neither layer alone is sufficient — both must pass for a request to succeed.
 *
 * CSP Nonce 使用方式（Issue #190）：
 *   - Server Components 可透過 headers() 讀取 'x-csp-nonce'
 *   - 將 nonce 傳給 <Script nonce={nonce}> 或自訂 inline script 元素
 *   - next.config.ts 的靜態 CSP 作為未進入此 middleware 路由的 fallback
 */

import { NextRequest, NextResponse } from "next/server";
import { checkEdgeJwt } from "@/lib/auth-depth";

/** CSP nonce header 名稱 — middleware 設定與 Server Components 讀取必須一致 */
const CSP_NONCE_HEADER = "x-csp-nonce";

/** 建構帶有動態 nonce 的 CSP header 值 */
function buildCspWithNonce(nonce: string): string {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
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

export async function middleware(req: NextRequest): Promise<NextResponse> {
  const { pathname } = new URL(req.url);

  // Request Correlation ID (Issue #199) — reuse upstream or generate UUID v4
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();

  // 生成每請求唯一 nonce（base64 編碼，Edge runtime 支援 crypto.getRandomValues）
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = Buffer.from(nonceBytes).toString("base64");

  // Skip auth routes — next-auth handles its own sign-in / callback / CSRF flows
  if (pathname.startsWith("/api/auth/")) {
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set(CSP_NONCE_HEADER, nonce);
    reqHeaders.set("x-request-id", requestId);
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", buildCspWithNonce(nonce));
    res.headers.set(CSP_NONCE_HEADER, nonce);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // Skip the change-password page itself to avoid redirect loops
  if (pathname === "/change-password") {
    const reqHeaders = new Headers(req.headers);
    reqHeaders.set(CSP_NONCE_HEADER, nonce);
    reqHeaders.set("x-request-id", requestId);
    const res = NextResponse.next({ request: { headers: reqHeaders } });
    res.headers.set("Content-Security-Policy", buildCspWithNonce(nonce));
    res.headers.set(CSP_NONCE_HEADER, nonce);
    res.headers.set("x-request-id", requestId);
    return res;
  }

  // Perform Edge JWT check
  const jwtResult = await checkEdgeJwt(req);
  if (jwtResult !== null) {
    // Page routes: redirect to /login instead of returning 401 JSON
    if (!pathname.startsWith("/api/")) {
      const loginUrl = new URL("/login", req.url);
      loginUrl.searchParams.set("callbackUrl", pathname);
      const redirectRes = NextResponse.redirect(loginUrl);
      redirectRes.headers.set("x-request-id", requestId);
      return redirectRes;
    }
    jwtResult.headers.set("x-request-id", requestId);
    return jwtResult; // 401 response for API routes — blocked at Edge before hitting Node.js
  }

  // 所有通過驗證的請求：注入 nonce-based CSP、x-csp-nonce、x-request-id
  // Route handlers 可透過 headers() 讀取 'x-request-id' 做跨層追蹤
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  requestHeaders.set("x-request-id", requestId);

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("Content-Security-Policy", buildCspWithNonce(nonce));
  res.headers.set(CSP_NONCE_HEADER, nonce);
  res.headers.set("x-request-id", requestId);
  return res;
}

export const config = {
  matcher: [
    // Page routes that require a session
    "/dashboard/:path*",
    "/kanban/:path*",
    "/gantt/:path*",
    "/knowledge/:path*",
    "/kpi/:path*",
    "/plans/:path*",
    "/timesheet/:path*",
    "/reports/:path*",
    // All API routes — auth routes are excluded inside the middleware function
    "/api/:path*",
  ],
};
