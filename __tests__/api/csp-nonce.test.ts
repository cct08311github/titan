/**
 * @jest-environment node
 */
/**
 * CSP nonce middleware tests — Issue #759
 *
 * Verifies that:
 * 1. generateNonce() produces base64-encoded nonces
 * 2. Each call produces a different nonce (cryptographic randomness)
 * 3. buildCspWithNonce() includes the nonce in script-src
 * 4. Dev mode includes 'unsafe-eval', prod mode does not
 * 5. applyCsp() sets both request and response headers
 */

import { NextResponse } from "next/server";

describe("CSP nonce middleware", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("generateNonce()", () => {
    it("should produce a base64-encoded string", async () => {
      const { generateNonce } = await import("@/lib/middleware/csp");
      const nonce = generateNonce();
      expect(nonce).toBeTruthy();
      // Base64: only alphanumeric, +, /, =
      expect(nonce).toMatch(/^[A-Za-z0-9+/]+=*$/);
    });

    it("should produce different nonces on each call", async () => {
      const { generateNonce } = await import("@/lib/middleware/csp");
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      // With 16 bytes of randomness, collisions are astronomically unlikely
      expect(nonces.size).toBe(100);
    });

    it("should produce 16-byte nonces (24 chars in base64)", async () => {
      const { generateNonce } = await import("@/lib/middleware/csp");
      const nonce = generateNonce();
      // 16 bytes → 24 chars in base64 (with padding: ceil(16/3)*4 = 24)
      expect(nonce.length).toBe(24);
    });
  });

  describe("buildCspWithNonce()", () => {
    it("should include the nonce in script-src directive", async () => {
      const { buildCspWithNonce } = await import("@/lib/middleware/csp");
      const nonce = "test-nonce-abc123";
      const csp = buildCspWithNonce(nonce);
      expect(csp).toContain(`'nonce-${nonce}'`);
    });

    it("should include unsafe-eval in development mode", async () => {
      process.env.NODE_ENV = "development";
      const { buildCspWithNonce } = await import("@/lib/middleware/csp");
      const csp = buildCspWithNonce("test-nonce");
      expect(csp).toContain("'unsafe-eval'");
      expect(csp).not.toContain("'strict-dynamic'");
    });

    it("should include strict-dynamic in production mode", async () => {
      process.env.NODE_ENV = "production";
      const { buildCspWithNonce } = await import("@/lib/middleware/csp");
      const csp = buildCspWithNonce("test-nonce");
      expect(csp).toContain("'strict-dynamic'");
      expect(csp).not.toContain("'unsafe-eval'");
    });

    it("should include all required CSP directives", async () => {
      const { buildCspWithNonce } = await import("@/lib/middleware/csp");
      const csp = buildCspWithNonce("test-nonce");
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("style-src 'self' 'unsafe-inline'");
      expect(csp).toContain("img-src 'self' data: blob:");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("base-uri 'self'");
      expect(csp).toContain("frame-ancestors 'self'");
    });
  });

  describe("applyCsp()", () => {
    it("should set CSP nonce on both request and response headers", async () => {
      const { applyCsp } = await import("@/lib/middleware/csp");
      const reqHeaders = new Headers();
      const res = NextResponse.next();
      const nonce = "test-nonce-xyz";

      applyCsp(reqHeaders, res, nonce);

      // Request header
      expect(reqHeaders.get("x-csp-nonce")).toBe(nonce);
      // Response headers
      expect(res.headers.get("x-csp-nonce")).toBe(nonce);
      expect(res.headers.get("Content-Security-Policy")).toContain(`'nonce-${nonce}'`);
    });
  });
});
