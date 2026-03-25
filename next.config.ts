import type { NextConfig } from "next";

/**
 * TITAN Next.js Configuration — Issue #192
 *
 * - output: standalone — required for Docker production builds
 * - poweredByHeader: false — hide X-Powered-By (security)
 * - Security headers — defense-in-depth (supplements Nginx headers)
 *
 * CSP 策略說明（Issue #190）：
 * - next.config.ts 的 headers() 為靜態設定，無法注入動態 nonce
 * - 動態 nonce 由 middleware.ts 負責生成並寫入 Content-Security-Policy 回應 header
 * - 此處 CSP 作為 fallback，覆蓋 middleware matcher 未涵蓋的靜態路由
 * - unsafe-eval 已完全移除；unsafe-inline 在 style-src 保留（Phase 2 再移除）
 */

/** CSP fallback（靜態路由用；動態路由由 middleware.ts 以 nonce 覆蓋） */
const CSP_STATIC = [
  "default-src 'self'",
  "script-src 'self'",
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

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), usb=()",
          },
          // CSP fallback（middleware.ts 對保護路由動態覆蓋為 nonce-based CSP）
          { key: "Content-Security-Policy", value: CSP_STATIC },
        ],
      },
    ];
  },
};

export default nextConfig;
