/**
 * Polyfills for Jest + jsdom environment.
 *
 * Prisma 7 client runtime bundles @noble/hashes which requires
 * TextEncoder/TextDecoder. These are not available in jsdom by default.
 *
 * This file runs via jest.config.ts `setupFiles` — before the test
 * environment is fully initialized and before any module imports.
 */
if (typeof globalThis.TextEncoder === "undefined") {
  const { TextEncoder, TextDecoder } = require("util");
  globalThis.TextEncoder = TextEncoder;
  globalThis.TextDecoder = TextDecoder;
}
