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

  // Issue #1508: externalize isomorphic-dompurify so Webpack does not bundle
  // (and minify-break) jsdom. The bundled jsdom in Next.js chunks was throwing
  // both `ENOENT browser/default-stylesheet.css` (fixed upstream by copying
  // the CSS to CWD) and `TypeError: h is not a function` (webpack minification
  // stripping a dynamic symbol jsdom uses). Externalizing keeps jsdom as a
  // real CommonJS module in node_modules at runtime, where its own relative
  // path resolution and dynamic requires work correctly.
  //
  // This supersedes the outputFileTracingIncludes approach from T1496 (#1499)
  // for the CSS file — once externalized, jsdom reads the CSS from its own
  // package directory via __dirname, no extra copy needed.
  serverExternalPackages: ["isomorphic-dompurify", "jsdom"],

  // Feature flag: TITAN_V2_ENABLED — toggle new vs old UI (Issue #970)
  env: {
    NEXT_PUBLIC_TITAN_V2_ENABLED: process.env.TITAN_V2_ENABLED ?? "true",
    NEXT_PUBLIC_APP_VERSION: require("./package.json").version ?? "0.0.0",
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
