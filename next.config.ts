import type { NextConfig } from "next";

/**
 * TITAN Next.js Configuration — Issue #192
 *
 * - output: standalone — required for Docker production builds
 * - poweredByHeader: false — hide X-Powered-By (security)
 * - Security headers — defense-in-depth (supplements Nginx headers)
 *
 * CSP 策略說明（Issue #190, #579, #594）：
 * - CSP 完全由 middleware.ts 動態生成（含 nonce）
 * - next.config.ts 不再設定 CSP header，避免覆蓋 middleware 的 nonce-based CSP
 * - 其他安全 headers 仍由此處靜態設定
 */

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  basePath: "/titan",

  // Feature flag: TITAN_V2_ENABLED — toggle new vs old UI (Issue #970)
  env: {
    NEXT_PUBLIC_TITAN_V2_ENABLED: process.env.TITAN_V2_ENABLED ?? "true",
  },

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
          // CSP is handled exclusively by middleware.ts with per-request nonce.
          // Do NOT add a Content-Security-Policy header here — it would override
          // the middleware's nonce-based CSP in production.
        ],
      },
    ];
  },
};

export default nextConfig;
