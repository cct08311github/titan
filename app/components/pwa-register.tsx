"use client";

import { useEffect } from "react";

/**
 * PWARegister — registers the service worker on production hostnames.
 * Renders nothing; side-effect only.
 *
 * Issue #1535: skipped on localhost / IP-only hostnames. Reasons:
 * 1. Service worker has zero value when developing — cache invalidation
 *    causes more harm than good
 * 2. CI runs against http://localhost:3100 where standalone-server
 *    public/ availability occasionally races; 404 fetch fires both a
 *    browser-native console error and our catch — breaks tests that
 *    assert zero console.error
 * 3. Real users always hit a production hostname (titan.example.com,
 *    *.tailde842d.ts.net, etc.) — unaffected by this guard
 */
function isProductionHost(): boolean {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host === "localhost") return false;
  if (host === "127.0.0.1" || host === "::1") return false;
  // Bare IPv4 address (no DNS name)
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  return true;
}

export default function PWARegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator &&
      isProductionHost()
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => {
          // Non-fatal. console.debug avoids polluting console.error
          // counts in e2e assertions; still visible in browser devtools
          // when filter is set to "All".
          console.debug("[PWA] Service worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
