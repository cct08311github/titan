"use client";

import { useEffect } from "react";

/**
 * PWARegister — registers the service worker in production.
 * Renders nothing; side-effect only.
 */
export default function PWARegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      typeof window !== "undefined" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .catch((err) => {
          // SW registration failure is non-fatal — log and continue
          console.error("[PWA] Service worker registration failed:", err);
        });
    }
  }, []);

  return null;
}
