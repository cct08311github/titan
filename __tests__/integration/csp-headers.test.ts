/**
 * @jest-environment node
 */
/**
 * CSP Header Integration Test — Issue #603
 *
 * Dedicated verification of Content-Security-Policy headers.
 * Tests the CSP module's output independently from the compose flow.
 *
 * Verifies:
 * 1. CSP header is present and well-formed
 * 2. Nonce is unique per invocation (simulating per-request)
 * 3. script-src contains nonce directive
 * 4. No 'unsafe-inline' in production CSP for script-src
 * 5. Required directives are all present
 */

describe("CSP Header Verification", () => {
  let generateNonce: typeof import("@/lib/middleware/csp").generateNonce;
  let buildCspWithNonce: typeof import("@/lib/middleware/csp").buildCspWithNonce;
  let applyCsp: typeof import("@/lib/middleware/csp").applyCsp;
  let CSP_NONCE_HEADER: string;

  beforeAll(async () => {
    const mod = await import("@/lib/middleware/csp");
    generateNonce = mod.generateNonce;
    buildCspWithNonce = mod.buildCspWithNonce;
    applyCsp = mod.applyCsp;
    CSP_NONCE_HEADER = mod.CSP_NONCE_HEADER;
  });

  // ── 1. CSP header presence and well-formedness ──────────────────────

  describe("CSP header presence", () => {
    it("applyCsp sets Content-Security-Policy header on response", () => {
      const { NextResponse } = require("next/server");
      const reqHeaders = new Headers();
      const res = NextResponse.next();
      const nonce = generateNonce();

      applyCsp(reqHeaders, res, nonce);

      const cspHeader = res.headers.get("Content-Security-Policy");
      expect(cspHeader).toBeTruthy();
      expect(typeof cspHeader).toBe("string");
      expect(cspHeader!.length).toBeGreaterThan(50);
    });

    it("CSP header contains all required directives", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      const requiredDirectives = [
        "default-src",
        "script-src",
        "style-src",
        "img-src",
        "font-src",
        "connect-src",
        "worker-src",
        "object-src",
        "base-uri",
        "form-action",
        "frame-ancestors",
      ];

      for (const directive of requiredDirectives) {
        expect(csp).toContain(directive);
      }
    });

    it("CSP directives are semicolon-separated", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      // Should have multiple directives separated by '; '
      const parts = csp.split("; ");
      expect(parts.length).toBeGreaterThanOrEqual(8);
    });
  });

  // ── 2. Nonce uniqueness ─────────────────────────────────────────────

  describe("Nonce uniqueness per request", () => {
    it("generates unique nonces across 100 invocations", () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 100; i++) {
        nonces.add(generateNonce());
      }
      // All 100 should be unique
      expect(nonces.size).toBe(100);
    });

    it("nonce is cryptographically random (16 bytes, base64)", () => {
      const nonce = generateNonce();
      // 16 bytes base64 = 24 characters (with padding)
      expect(nonce.length).toBe(24);
      // Should be valid base64
      expect(() => Buffer.from(nonce, "base64")).not.toThrow();
      const decoded = Buffer.from(nonce, "base64");
      expect(decoded.length).toBe(16);
    });

    it("two consecutive applyCsp calls produce different nonces in CSP", () => {
      const { NextResponse } = require("next/server");

      const nonce1 = generateNonce();
      const nonce2 = generateNonce();

      const res1 = NextResponse.next();
      const res2 = NextResponse.next();
      applyCsp(new Headers(), res1, nonce1);
      applyCsp(new Headers(), res2, nonce2);

      const csp1 = res1.headers.get("Content-Security-Policy");
      const csp2 = res2.headers.get("Content-Security-Policy");

      expect(csp1).not.toBe(csp2);
    });
  });

  // ── 3. script-src contains nonce ────────────────────────────────────

  describe("script-src nonce directive", () => {
    it("script-src contains the exact nonce value", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      // Extract script-src directive
      const scriptSrc = csp
        .split("; ")
        .find((d) => d.startsWith("script-src"));
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).toContain(`'nonce-${nonce}'`);
    });

    it("nonce is propagated to x-csp-nonce request header", () => {
      const { NextResponse } = require("next/server");
      const reqHeaders = new Headers();
      const res = NextResponse.next();
      const nonce = generateNonce();

      applyCsp(reqHeaders, res, nonce);

      expect(reqHeaders.get(CSP_NONCE_HEADER)).toBe(nonce);
    });

    it("nonce is propagated to x-csp-nonce response header", () => {
      const { NextResponse } = require("next/server");
      const reqHeaders = new Headers();
      const res = NextResponse.next();
      const nonce = generateNonce();

      applyCsp(reqHeaders, res, nonce);

      expect(res.headers.get(CSP_NONCE_HEADER)).toBe(nonce);
    });
  });

  // ── 4. No unsafe-inline in production CSP script-src ────────────────

  describe("Production CSP security", () => {
    const originalEnv = process.env.NODE_ENV;

    afterEach(() => {
      // Restore original NODE_ENV
      if (originalEnv !== undefined) {
        process.env.NODE_ENV = originalEnv;
      }
    });

    it("production CSP script-src does NOT contain unsafe-inline", () => {
      // buildCspWithNonce checks process.env.NODE_ENV internally
      // In test environment NODE_ENV=test which maps to production CSP path
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      const scriptSrc = csp
        .split("; ")
        .find((d) => d.startsWith("script-src"));
      expect(scriptSrc).toBeDefined();
      expect(scriptSrc).not.toContain("'unsafe-inline'");
    });

    it("production CSP script-src contains strict-dynamic", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      const scriptSrc = csp
        .split("; ")
        .find((d) => d.startsWith("script-src"));
      expect(scriptSrc).toContain("'strict-dynamic'");
    });

    it("CSP contains object-src 'none' (XSS mitigation)", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      expect(csp).toContain("object-src 'none'");
    });

    it("CSP contains base-uri 'self' (base tag injection prevention)", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      expect(csp).toContain("base-uri 'self'");
    });

    it("CSP contains form-action 'self' (form hijacking prevention)", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      expect(csp).toContain("form-action 'self'");
    });

    it("CSP contains frame-ancestors 'self' (clickjacking prevention)", () => {
      const nonce = generateNonce();
      const csp = buildCspWithNonce(nonce);

      expect(csp).toContain("frame-ancestors 'self'");
    });
  });
});
