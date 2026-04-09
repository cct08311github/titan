/**
 * @jest-environment node
 */
/**
 * JWT Auth Flow tests — Issue #795 (AU-1)
 *
 * Tests: refresh token rotation, revocation, bcrypt cost,
 * token payload, session TTL, logout flow.
 */
import path from "path";

const ROOT = process.cwd();

const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockAuthFn(...args) }));

const mockRefreshTokenCreate = jest.fn().mockResolvedValue({ id: "rt-1" });
const mockRefreshTokenFindUnique = jest.fn();
const mockRefreshTokenUpdate = jest.fn().mockResolvedValue({});
const mockRefreshTokenUpdateMany = jest.fn().mockResolvedValue({ count: 1 });
const mockUserFindUnique = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    refreshToken: {
      create: (...args: unknown[]) => mockRefreshTokenCreate(...args),
      findUnique: (...args: unknown[]) => mockRefreshTokenFindUnique(...args),
      update: (...args: unknown[]) => mockRefreshTokenUpdate(...args),
      updateMany: (...args: unknown[]) => mockRefreshTokenUpdateMany(...args),
    },
    user: {
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
    },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
  },
}));

jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: () => ({}), checkRateLimit: jest.fn(), createLoginRateLimiter: () => ({}),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));

import { NextRequest } from "next/server";

// ═══════════════════════════════════════════════════════════════════════
// JWT token service tests
// ═══════════════════════════════════════════════════════════════════════

describe("JWT token service", () => {
  let issueRefreshToken: typeof import("@/lib/auth/jwt").issueRefreshToken;
  let rotateRefreshToken: typeof import("@/lib/auth/jwt").rotateRefreshToken;
  let revokeAllRefreshTokens: typeof import("@/lib/auth/jwt").revokeAllRefreshTokens;
  let revokeRefreshToken: typeof import("@/lib/auth/jwt").revokeRefreshToken;

  beforeAll(async () => {
    const mod = await import("@/lib/auth/jwt");
    issueRefreshToken = mod.issueRefreshToken;
    rotateRefreshToken = mod.rotateRefreshToken;
    revokeAllRefreshTokens = mod.revokeAllRefreshTokens;
    revokeRefreshToken = mod.revokeRefreshToken;
  });

  beforeEach(() => jest.clearAllMocks());

  it("should issue a refresh token and store hash in DB", async () => {
    const token = await issueRefreshToken("user-1");
    expect(typeof token).toBe("string");
    expect(token.length).toBe(64); // 32 bytes hex
    expect(mockRefreshTokenCreate).toHaveBeenCalledTimes(1);
    const call = mockRefreshTokenCreate.mock.calls[0][0];
    expect(call.data.userId).toBe("user-1");
    expect(call.data.tokenHash).toBeDefined();
    expect(call.data.tokenHash).not.toBe(token); // hash, not raw
    expect(call.data.expiresAt).toBeInstanceOf(Date);
    // 7 day TTL check
    const ttl = call.data.expiresAt.getTime() - Date.now();
    expect(ttl).toBeGreaterThan(6 * 24 * 60 * 60 * 1000);
    expect(ttl).toBeLessThanOrEqual(7 * 24 * 60 * 60 * 1000 + 1000);
  });

  it("should return null for non-existent token on rotate", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce(null);
    const result = await rotateRefreshToken("nonexistent");
    expect(result).toBeNull();
  });

  it("should return null for revoked token and revoke all user tokens", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: "rt-1", userId: "user-1", revokedAt: new Date(), expiresAt: new Date(Date.now() + 86400000),
    });
    const result = await rotateRefreshToken("revoked-token");
    expect(result).toBeNull();
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalled(); // revoke all
  });

  it("should return null for expired token", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: "rt-1", userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() - 1000),
    });
    const result = await rotateRefreshToken("expired-token");
    expect(result).toBeNull();
  });

  it("should rotate valid token: revoke old, issue new", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: "rt-1", userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() + 86400000),
    });
    const result = await rotateRefreshToken("valid-token");
    expect(result).not.toBeNull();
    expect(result!.userId).toBe("user-1");
    expect(typeof result!.newToken).toBe("string");
    expect(mockRefreshTokenUpdate).toHaveBeenCalled(); // revoke old
    expect(mockRefreshTokenCreate).toHaveBeenCalled(); // issue new
  });

  it("should revoke all tokens for a user", async () => {
    await revokeAllRefreshTokens("user-1");
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it("should revoke single token by raw value", async () => {
    await revokeRefreshToken("some-raw-token");
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/refresh tests
// ═══════════════════════════════════════════════════════════════════════

describe("POST /api/auth/refresh", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/auth/refresh/route");
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  it("should return 400 for missing refreshToken", async () => {
    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST", body: JSON.stringify({}),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("should return 401 for invalid token", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce(null);
    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST", body: JSON.stringify({ refreshToken: "bad" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("should return new token pair for valid refresh", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: "rt-1", userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() + 86400000),
    });
    mockUserFindUnique.mockResolvedValueOnce({
      id: "user-1", name: "Alice", email: "alice@test.com", role: "ENGINEER", isActive: true,
    });
    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST", body: JSON.stringify({ refreshToken: "valid-token" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.refreshToken).toBeDefined();
    expect(body.data.user.id).toBe("user-1");
    expect(body.data.expiresIn).toBe(900); // 15 min
  });

  it("should return 401 for disabled user", async () => {
    mockRefreshTokenFindUnique.mockResolvedValueOnce({
      id: "rt-1", userId: "user-1", revokedAt: null, expiresAt: new Date(Date.now() + 86400000),
    });
    mockUserFindUnique.mockResolvedValueOnce({ id: "user-1", isActive: false });
    const req = new NextRequest("http://localhost/api/auth/refresh", {
      method: "POST", body: JSON.stringify({ refreshToken: "valid-token" }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});

// ═══════════════════════════════════════════════════════════════════════
// POST /api/auth/logout tests
// ═══════════════════════════════════════════════════════════════════════

describe("POST /api/auth/logout", () => {
  let POST: (req: NextRequest) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/auth/logout/route");
    POST = mod.POST;
  });

  beforeEach(() => jest.clearAllMocks());

  it("should revoke refresh token on logout", async () => {
    mockAuthFn.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST", body: JSON.stringify({ refreshToken: "some-token" }),
    });
    const res = await POST(req);
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.message).toBe("已登出");
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalled();
  });

  it("should revoke all tokens when no specific token given", async () => {
    mockAuthFn.mockResolvedValue({ user: { id: "user-1" } });
    const req = new NextRequest("http://localhost/api/auth/logout", {
      method: "POST", body: "{}",
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════
// bcrypt cost factor check
// ═══════════════════════════════════════════════════════════════════════

describe("bcrypt cost factor", () => {
  it("user-service uses cost >= 12", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "services/user-service.ts"),
      "utf8"
    );
    const matches = content.match(/hash\([^,]+,\s*(\d+)\)/g) ?? [];
    for (const m of matches) {
      const costMatch = m.match(/,\s*(\d+)\)/);
      if (costMatch) {
        expect(parseInt(costMatch[1])).toBeGreaterThanOrEqual(12);
      }
    }
  });

  it("change-password uses cost >= 12", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/api/auth/change-password/route.ts"),
      "utf8"
    );
    const matches = content.match(/hash\([^,]+,\s*(\d+)\)/g) ?? [];
    for (const m of matches) {
      const costMatch = m.match(/,\s*(\d+)\)/);
      if (costMatch) {
        expect(parseInt(costMatch[1])).toBeGreaterThanOrEqual(12);
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════
// Token payload check
// ═══════════════════════════════════════════════════════════════════════

describe("JWT token payload (auth.ts callbacks)", () => {
  it("auth.ts jwt callback sets id, role, and sessionId (no sensitive data)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "auth.ts"),
      "utf8"
    );
    expect(content).toContain("token.id = user.id");
    expect(content).toContain("token.role");
    // Must NOT store raw password or hash in token (passwordChangedAt is OK)
    expect(content).not.toMatch(/token\.password\s*=/);
    expect(content).not.toMatch(/token\.hash\s*=/);
  });

  it("session maxAge is 15 minutes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "auth.ts"),
      "utf8"
    );
    expect(content).toContain("15 * 60");
  });
});
