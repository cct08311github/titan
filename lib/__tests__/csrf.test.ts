/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #125: CSRF protection — Origin validation + SameSite cookie
 */

import { NextRequest } from "next/server";

// ── Mock next/server ──────────────────────────────────────────────────────
jest.mock("next/server", () => {
  const actual = jest.requireActual("next/server");
  return {
    ...actual,
    NextResponse: {
      json: jest.fn((body: unknown, init?: { status?: number }) => ({
        status: init?.status ?? 200,
        _body: body,
        json: async () => body,
      })),
    },
  };
});

// ── Import after mocks ────────────────────────────────────────────────────
import { validateCsrf, CsrfError } from "@/lib/csrf";

// ── Helpers ───────────────────────────────────────────────────────────────
function makeRequest(overrides: {
  url?: string;
  origin?: string | null;
  host?: string | null;
  method?: string;
}): NextRequest {
  const url = overrides.url ?? "http://localhost:3000/api/test";
  const headers = new Headers();
  if (overrides.origin !== undefined && overrides.origin !== null) {
    headers.set("origin", overrides.origin);
  }
  if (overrides.host !== undefined && overrides.host !== null) {
    headers.set("host", overrides.host);
  }
  return {
    url,
    method: overrides.method ?? "POST",
    headers,
    json: jest.fn(),
  } as unknown as NextRequest;
}

// ── Test: same-origin request passes ─────────────────────────────────────

describe("validateCsrf — same-origin", () => {
  it("passes when Origin matches Host", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/users",
      origin: "http://localhost:3000",
      host: "localhost:3000",
    });
    // Should not throw
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it("passes when Origin matches production host", () => {
    const req = makeRequest({
      url: "https://titan.example.com/api/users",
      origin: "https://titan.example.com",
      host: "titan.example.com",
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it("passes for GET requests regardless of Origin (safe method)", () => {
    const req = makeRequest({
      method: "GET",
      origin: "https://evil.com",
      host: "titan.example.com",
    });
    // GET is a safe/idempotent method — CSRF protection is not needed
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it("passes for HEAD requests (safe method)", () => {
    const req = makeRequest({
      method: "HEAD",
      origin: "https://evil.com",
      host: "titan.example.com",
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });
});

// ── Test: cross-origin request blocked with 403 ───────────────────────────

describe("validateCsrf — cross-origin blocked", () => {
  it("throws CsrfError when Origin does not match Host on POST", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/users",
      origin: "https://evil.com",
      host: "localhost:3000",
    });
    expect(() => validateCsrf(req)).toThrow(CsrfError);
  });

  it("throws CsrfError when Origin does not match Host on PUT", () => {
    const req = makeRequest({
      method: "PUT",
      url: "https://titan.example.com/api/users/1",
      origin: "https://attacker.io",
      host: "titan.example.com",
    });
    expect(() => validateCsrf(req)).toThrow(CsrfError);
  });

  it("throws CsrfError when Origin does not match Host on DELETE", () => {
    const req = makeRequest({
      method: "DELETE",
      url: "https://titan.example.com/api/users/1",
      origin: "https://attacker.io",
      host: "titan.example.com",
    });
    expect(() => validateCsrf(req)).toThrow(CsrfError);
  });

  it("throws CsrfError when Origin does not match Host on PATCH", () => {
    const req = makeRequest({
      method: "PATCH",
      url: "https://titan.example.com/api/users/1",
      origin: "https://attacker.io",
      host: "titan.example.com",
    });
    expect(() => validateCsrf(req)).toThrow(CsrfError);
  });

  it("CsrfError has status 403", () => {
    const req = makeRequest({
      origin: "https://evil.com",
      host: "localhost:3000",
    });
    try {
      validateCsrf(req);
      fail("Expected CsrfError to be thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(CsrfError);
      expect((err as CsrfError).statusCode).toBe(403);
    }
  });
});

// ── Test: request without Origin header handled safely ────────────────────

describe("validateCsrf — missing Origin header", () => {
  it("passes when Origin header is absent on POST (server-to-server / curl)", () => {
    // Requests without an Origin header are typically direct server calls or
    // same-origin form submissions from older browsers. We allow them because
    // a browser CSRF attack will always include the Origin header.
    const req = makeRequest({
      url: "http://localhost:3000/api/test",
      origin: null,
      host: "localhost:3000",
      method: "POST",
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });

  it("passes when both Origin and Host headers are absent", () => {
    const req = makeRequest({
      url: "http://localhost:3000/api/test",
      origin: null,
      host: null,
      method: "POST",
    });
    expect(() => validateCsrf(req)).not.toThrow();
  });
});

// ── Test: NextAuth CSRF token validation ─────────────────────────────────

describe("validateCsrf — NextAuth CSRF token", () => {
  it("CsrfError message mentions CSRF", () => {
    const req = makeRequest({
      origin: "https://evil.com",
      host: "titan.example.com",
      method: "POST",
    });
    try {
      validateCsrf(req);
    } catch (err) {
      expect(err).toBeInstanceOf(CsrfError);
      expect((err as CsrfError).message).toMatch(/csrf/i);
    }
  });

  it("validateCsrf is a function", () => {
    expect(typeof validateCsrf).toBe("function");
  });

  it("CsrfError is a class extending Error", () => {
    const e = new CsrfError("test");
    expect(e).toBeInstanceOf(Error);
    expect(e).toBeInstanceOf(CsrfError);
    expect(e.message).toBe("test");
  });

  it("passes NextAuth own routes (/api/auth/*) regardless of origin", () => {
    // NextAuth handles its own CSRF internally via csrfToken cookie
    const req = makeRequest({
      url: "http://localhost:3000/api/auth/csrf",
      origin: "https://evil.com",
      host: "localhost:3000",
      method: "POST",
    });
    // NextAuth routes should be excluded from our custom CSRF check
    expect(() => validateCsrf(req)).not.toThrow();
  });
});
