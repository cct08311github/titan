import type { NextConfig } from "next";

/**
 * TITAN Next.js Configuration — Issue #192
 *
 * - output: standalone — required for Docker production builds
 * - poweredByHeader: false — hide X-Powered-By (security)
 * - Security headers — defense-in-depth (supplements Nginx headers)
 */
const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  turbopack: {},

  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "1; mode=block" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
