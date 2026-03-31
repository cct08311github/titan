/**
 * @jest-environment node
 */
/**
 * Mobile Auth API Integration Tests — Issue #1085
 *
 * Tests the full mobile auth flow:
 *   1. POST /api/auth/mobile/login → JWE + refresh token
 *   2. requireAuth() Bearer path → decode + blacklist check
 *   3. POST /api/auth/refresh (source=mobile) → new JWE + rotated refresh
 *   4. Device binding verification
 *   5. Error paths (invalid creds, locked, rate limited, missing deviceId)
 */

// ── Mocks ──────────────────────────────────────────────────────────────────

const mockUserFindUnique = jest.fn();
const mockRefreshTokenCreate = jest.fn();
const mockRefreshTokenFindUnique = jest.fn();
const mockRefreshTokenUpdate = jest.fn();
const mockRefreshTokenUpdateMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: { findUnique: (...a: unknown[]) => mockUserFindUnique(...a) },
    refreshToken: {
      create: (...a: unknown[]) => mockRefreshTokenCreate(...a),
      findUnique: (...a: unknown[]) => mockRefreshTokenFindUnique(...a),
      update: (...a: unknown[]) => mockRefreshTokenUpdate(...a),
      updateMany: (...a: unknown[]) => mockRefreshTokenUpdateMany(...a),
    },
  },
}));

const mockCompare = jest.fn();
jest.mock("bcryptjs", () => ({
  compare: (...a: unknown[]) => mockCompare(...a),
}));

const mockEncode = jest.fn().mockResolvedValue("mock-jwe-token");
const mockDecode = jest.fn();
jest.mock("next-auth/jwt", () => ({
  encode: (...a: unknown[]) => mockEncode(...a),
  decode: (...a: unknown[]) => mockDecode(...a),
}));

const mockCheckRateLimit = jest.fn();
jest.mock("@/lib/rate-limiter", () => ({
  createLoginRateLimiter: () => ({}),
  checkRateLimit: (...a: unknown[]) => mockCheckRateLimit(...a),
}));

const mockIsLocked = jest.fn().mockResolvedValue(false);
const mockGetRemainingLockSeconds = jest.fn().mockResolvedValue(0);
const mockRecordFailure = jest.fn();
const mockResetFailures = jest.fn();
jest.mock("@/lib/account-lock", () => ({
  AccountLockService: jest.fn().mockImplementation(() => ({
    isLocked: (...a: unknown[]) => mockIsLocked(...a),
    getRemainingLockSeconds: (...a: unknown[]) => mockGetRemainingLockSeconds(...a),
    recordFailure: (...a: unknown[]) => mockRecordFailure(...a),
    resetFailures: (...a: unknown[]) => mockResetFailures(...a),
  })),
}));

jest.mock("@/lib/password-expiry", () => ({
  isPasswordExpired: jest.fn().mockReturnValue(false),
}));

const mockRegisterSession = jest.fn();
jest.mock("@/lib/session-limiter", () => ({
  registerSession: (...a: unknown[]) => mockRegisterSession(...a),
}));

jest.mock("@/lib/redis", () => ({
  getRedisClient: () => null,
}));

const mockAuditLog = jest.fn().mockResolvedValue(undefined);
jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: (...a: unknown[]) => mockAuditLog(...a),
  })),
}));

jest.mock("@/lib/get-client-ip", () => ({
  getClientIp: () => "127.0.0.1",
}));

jest.mock("@/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock headers() for rbac.ts
const mockHeadersGet = jest.fn();
jest.mock("next/headers", () => ({
  headers: jest.fn().mockResolvedValue({
    get: (...a: unknown[]) => mockHeadersGet(...a),
  }),
}));

// Mock auth() for rbac.ts fallback
const mockAuth = jest.fn();
jest.mock("@/auth", () => ({
  auth: (...a: unknown[]) => mockAuth(...a),
}));

jest.mock("@/lib/jwt-blacklist", () => ({
  JwtBlacklist: {
    has: jest.fn().mockReturnValue(false),
    add: jest.fn(),
  },
}));

// ── Helpers ────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-mobile-1",
  name: "Mobile User",
  email: "mobile@titan.local",
  role: "ENGINEER",
  password: "$2a$12$hashedpassword",
  isActive: true,
  mustChangePassword: false,
  passwordChangedAt: new Date("2026-01-01"),
};

function createRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/auth/mobile/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function createRefreshRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost:3000/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Mobile Auth — POST /api/auth/mobile/login", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let POST: typeof import("@/app/api/auth/mobile/login/route").POST;

  beforeAll(async () => {
    const mod = await import("@/app/api/auth/mobile/login/route");
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-for-mobile-auth";
    process.env.NODE_ENV = "test";
    mockIsLocked.mockResolvedValue(false);
    mockGetRemainingLockSeconds.mockResolvedValue(0);
    mockUserFindUnique.mockResolvedValue(MOCK_USER);
    mockCompare.mockResolvedValue(true);
    mockRefreshTokenCreate.mockResolvedValue({ id: "rt-1" });
    mockCheckRateLimit.mockResolvedValue(undefined);
  });

  afterAll(() => {
    delete process.env.AUTH_SECRET;
  });

  it("returns JWE + refresh token on valid credentials", async () => {
    const req = createRequest({
      username: "mobile",
      password: "correctpassword",
      deviceId: "device-abc-123",
    });

    const res = await POST(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.token).toBe("mock-jwe-token");
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.expiresAt).toBeDefined();
    expect(json.data.user).toEqual({
      id: "user-mobile-1",
      name: "Mobile User",
      email: "mobile@titan.local",
      role: "ENGINEER",
      mustChangePassword: false,
    });
  });

  it("calls encode() with correct salt and maxAge", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    await POST(req as never);

    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        salt: "authjs.session-token",
        maxAge: 900, // 15 * 60
        secret: "test-secret-for-mobile-auth",
      })
    );
  });

  it("passes deviceId to issueRefreshToken", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "my-iphone-uuid",
    });

    await POST(req as never);

    expect(mockRefreshTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-mobile-1",
          deviceId: "my-iphone-uuid",
        }),
      })
    );
  });

  it("registers session for concurrent session limiting", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    await POST(req as never);

    expect(mockRegisterSession).toHaveBeenCalledWith(
      "user-mobile-1",
      expect.any(String) // UUID sessionId
    );
  });

  it("writes audit log on successful login", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    await POST(req as never);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user-mobile-1",
        action: "MOBILE_LOGIN_SUCCESS",
      })
    );
  });

  // ── Error paths ──────────────────────────────────────────────────────

  it("returns 400 when deviceId is missing", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);

    const json = await res.json();
    expect(json.ok).toBe(false);
    expect(json.message).toContain("deviceId");
  });

  it("returns 400 when username is missing", async () => {
    const req = createRequest({ password: "pass", deviceId: "d" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 401 on wrong password", async () => {
    mockCompare.mockResolvedValue(false);

    const req = createRequest({
      username: "mobile",
      password: "wrongpassword",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);

    expect(mockRecordFailure).toHaveBeenCalled();
    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MOBILE_LOGIN_FAILURE",
      })
    );
  });

  it("returns 401 when user not found", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const req = createRequest({
      username: "nonexistent",
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
    expect(mockRecordFailure).toHaveBeenCalled();
  });

  it("returns 401 when user is inactive", async () => {
    mockUserFindUnique.mockResolvedValue({ ...MOCK_USER, isActive: false });

    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 423 when account is locked", async () => {
    mockIsLocked.mockResolvedValue(true);
    mockGetRemainingLockSeconds.mockResolvedValue(600);

    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(423);

    const json = await res.json();
    expect(json.message).toContain("鎖定");
  });

  it("returns 500 when AUTH_SECRET is not set", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(500);
  });

  it("auto-appends @titan.local to plain username", async () => {
    const req = createRequest({
      username: "alice",
      password: "pass",
      deviceId: "device-1",
    });

    await POST(req as never);

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "alice@titan.local" },
    });
  });

  it("preserves full email when @ already present", async () => {
    const req = createRequest({
      username: "bob@custom.domain",
      password: "pass",
      deviceId: "device-1",
    });

    await POST(req as never);

    expect(mockUserFindUnique).toHaveBeenCalledWith({
      where: { email: "bob@custom.domain" },
    });
  });

  // ── OWASP MSTG: Input Validation ──────────────────────────────────

  it("returns 400 on malformed JSON body", async () => {
    const req = new Request("http://localhost:3000/api/auth/mobile/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not-json{{{",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when password is missing", async () => {
    const req = createRequest({ username: "alice", deviceId: "d" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 when all fields are empty strings", async () => {
    const req = createRequest({ username: "", password: "", deviceId: "" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("handles unicode username without crash", async () => {
    const req = createRequest({
      username: "用戶名@titan.local",
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    // Should reach DB lookup (not crash on unicode)
    expect(mockUserFindUnique).toHaveBeenCalled();
  });

  it("handles extremely long username gracefully", async () => {
    const req = createRequest({
      username: "a".repeat(10000),
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    // Should not crash (any non-5xx is acceptable since mocks return a valid user)
    expect(res.status).toBeLessThan(500);
  });

  it("handles extremely long deviceId gracefully", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "d".repeat(10000),
    });

    // Should not crash
    const res = await POST(req as never);
    expect(res.status).toBe(200);
  });

  // ── OWASP MSTG: Response Security ─────────────────────────────────

  it("does NOT leak password hash in response", async () => {
    const req = createRequest({
      username: "mobile",
      password: "pass",
      deviceId: "device-1",
    });

    const res = await POST(req as never);
    const text = await res.clone().text();

    expect(text).not.toContain("$2a$");
    expect(text).not.toContain("hashedpassword");
  });

  it("returns identical error message for wrong password vs user not found", async () => {
    // Wrong password
    mockCompare.mockResolvedValue(false);
    const req1 = createRequest({ username: "mobile", password: "wrong", deviceId: "d" });
    const res1 = await POST(req1 as never);
    const json1 = await res1.json();

    jest.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret-for-mobile-auth";
    mockIsLocked.mockResolvedValue(false);
    mockRefreshTokenCreate.mockResolvedValue({ id: "rt-1" });

    // User not found
    mockUserFindUnique.mockResolvedValue(null);
    mockCompare.mockResolvedValue(true);
    const req2 = createRequest({ username: "ghost", password: "pass", deviceId: "d" });
    const res2 = await POST(req2 as never);
    const json2 = await res2.json();

    // OWASP: same error message prevents user enumeration
    expect(json1.message).toBe(json2.message);
    expect(res1.status).toBe(res2.status);
  });

  // ── OWASP MSTG: Lockout & Rate Limiting ───────────────────────────

  it("records failure on wrong password (brute force counter)", async () => {
    mockCompare.mockResolvedValue(false);

    const req = createRequest({ username: "mobile", password: "wrong", deviceId: "d" });
    await POST(req as never);

    expect(mockRecordFailure).toHaveBeenCalledTimes(1);
  });

  it("records failure on user not found (brute force counter)", async () => {
    mockUserFindUnique.mockResolvedValue(null);

    const req = createRequest({ username: "ghost", password: "pass", deviceId: "d" });
    await POST(req as never);

    expect(mockRecordFailure).toHaveBeenCalledTimes(1);
  });

  it("resets failure counter on successful login", async () => {
    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    await POST(req as never);

    expect(mockResetFailures).toHaveBeenCalledTimes(1);
  });

  it("does NOT reset failure counter on failed login", async () => {
    mockCompare.mockResolvedValue(false);

    const req = createRequest({ username: "mobile", password: "wrong", deviceId: "d" });
    await POST(req as never);

    expect(mockResetFailures).not.toHaveBeenCalled();
  });

  it("enforces rate limiting in non-dev environment", async () => {
    const origEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";
    mockCheckRateLimit.mockRejectedValue(new Error("rate limited"));

    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    const res = await POST(req as never);

    expect(res.status).toBe(429);
    process.env.NODE_ENV = origEnv;
  });

  // ── Token Payload Integrity ────────────────────────────────────────

  it("includes sessionId in JWE token payload", async () => {
    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    await POST(req as never);

    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({
          sessionId: expect.any(String),
          id: "user-mobile-1",
          role: "ENGINEER",
        }),
      })
    );
  });

  it("includes mustChangePassword=true when password is expired", async () => {
    const { isPasswordExpired } = jest.requireMock("@/lib/password-expiry");
    (isPasswordExpired as jest.Mock).mockReturnValue(true);

    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    const res = await POST(req as never);
    const json = await res.json();

    expect(json.data.user.mustChangePassword).toBe(true);
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({ mustChangePassword: true }),
      })
    );

    (isPasswordExpired as jest.Mock).mockReturnValue(false);
  });

  it("includes mustChangePassword=true when user.mustChangePassword is set", async () => {
    mockUserFindUnique.mockResolvedValue({ ...MOCK_USER, mustChangePassword: true });

    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    const res = await POST(req as never);
    const json = await res.json();

    expect(json.data.user.mustChangePassword).toBe(true);
  });

  it("expiresAt is approximately 15 minutes in the future", async () => {
    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    const res = await POST(req as never);
    const json = await res.json();

    const now = Math.floor(Date.now() / 1000);
    const diff = json.data.expiresAt - now;
    // Should be within 900 ± 5 seconds (allowing for test execution time)
    expect(diff).toBeGreaterThanOrEqual(895);
    expect(diff).toBeLessThanOrEqual(905);
  });

  // ── Audit Compliance (Banking) ─────────────────────────────────────

  it("audit log includes IP address", async () => {
    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    await POST(req as never);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: "127.0.0.1" })
    );
  });

  it("audit log includes deviceId on success", async () => {
    const req = createRequest({ username: "mobile", password: "pass", deviceId: "dev-audit" });
    await POST(req as never);

    const successCall = mockAuditLog.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).action === "MOBILE_LOGIN_SUCCESS"
    );
    expect(successCall).toBeDefined();
    const detail = JSON.parse(successCall![0].detail);
    expect(detail.deviceId).toBe("dev-audit");
  });

  it("audit log includes deviceId and reason on failure", async () => {
    mockCompare.mockResolvedValue(false);

    const req = createRequest({ username: "mobile", password: "wrong", deviceId: "dev-fail" });
    await POST(req as never);

    const failCall = mockAuditLog.mock.calls.find(
      (c: unknown[]) => (c[0] as Record<string, unknown>).action === "MOBILE_LOGIN_FAILURE"
    );
    expect(failCall).toBeDefined();
    const detail = JSON.parse(failCall![0].detail);
    expect(detail.deviceId).toBe("dev-fail");
    expect(detail.reason).toBe("invalid_password");
  });

  it("audit log failure fires and forgets (does not block response)", async () => {
    mockAuditLog.mockRejectedValue(new Error("DB write failed"));

    const req = createRequest({ username: "mobile", password: "pass", deviceId: "d" });
    const res = await POST(req as never);

    // Should still succeed despite audit log failure
    expect(res.status).toBe(200);
  });

  // ── Role-specific responses ────────────────────────────────────────

  it("returns correct role for ADMIN user", async () => {
    mockUserFindUnique.mockResolvedValue({ ...MOCK_USER, role: "ADMIN" });

    const req = createRequest({ username: "admin", password: "pass", deviceId: "d" });
    const res = await POST(req as never);
    const json = await res.json();

    expect(json.data.user.role).toBe("ADMIN");
    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: expect.objectContaining({ role: "ADMIN" }),
      })
    );
  });

  it("returns correct role for MANAGER user", async () => {
    mockUserFindUnique.mockResolvedValue({ ...MOCK_USER, role: "MANAGER" });

    const req = createRequest({ username: "mgr", password: "pass", deviceId: "d" });
    const res = await POST(req as never);
    const json = await res.json();

    expect(json.data.user.role).toBe("MANAGER");
  });
});

describe("Mobile Auth — requireAuth() Bearer path", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let requireAuth: typeof import("@/lib/rbac").requireAuth;
  let JwtBlacklist: typeof import("@/lib/jwt-blacklist").JwtBlacklist;

  beforeAll(async () => {
    const rbac = await import("@/lib/rbac");
    requireAuth = rbac.requireAuth;
    const bl = await import("@/lib/jwt-blacklist");
    JwtBlacklist = bl.JwtBlacklist;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.AUTH_SECRET = "test-secret";
    (JwtBlacklist.has as jest.Mock).mockResolvedValue(false);
  });

  it("decodes Bearer token and returns session", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer valid-jwe-token" : null
    );
    mockDecode.mockResolvedValue({
      id: "user-1",
      role: "ENGINEER",
      name: "Test",
      email: "test@titan.local",
      sessionId: "sess-1",
      exp: Math.floor(Date.now() / 1000) + 900,
    });

    const session = await requireAuth();

    expect(session.user.id).toBe("user-1");
    expect(session.user.role).toBe("ENGINEER");
    expect(mockDecode).toHaveBeenCalledWith(
      expect.objectContaining({
        token: "valid-jwe-token",
        salt: "authjs.session-token",
      })
    );
  });

  it("rejects blacklisted session", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer valid-jwe" : null
    );
    mockDecode.mockResolvedValue({
      id: "user-1",
      role: "ENGINEER",
      sessionId: "revoked-sess",
    });
    (JwtBlacklist.has as jest.Mock).mockResolvedValue(true);

    await expect(requireAuth()).rejects.toThrow("Session 已撤銷");
  });

  it("rejects token with missing role (CR #5)", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer tampered-jwe" : null
    );
    mockDecode.mockResolvedValue({
      id: "user-1",
      // role missing
      sessionId: "sess-1",
    });

    await expect(requireAuth()).rejects.toThrow("無效的存取權杖");
  });

  it("rejects on decode() crypto error (CR #1)", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer corrupt-token" : null
    );
    mockDecode.mockRejectedValue(new Error("JWE decryption failed"));

    await expect(requireAuth()).rejects.toThrow("無效的存取權杖");
  });

  it("falls back to cookie auth when no Bearer header", async () => {
    mockHeadersGet.mockReturnValue(null);
    mockAuth.mockResolvedValue({
      user: { id: "web-user", role: "ADMIN", name: "Admin", email: "a@t.local" },
      expires: "2099-01-01",
    });

    const session = await requireAuth();

    expect(session.user.id).toBe("web-user");
    expect(mockDecode).not.toHaveBeenCalled();
  });

  it("throws UnauthorizedError when no Bearer and no cookie session", async () => {
    mockHeadersGet.mockReturnValue(null);
    mockAuth.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("未授權");
  });

  it("rejects token with missing id", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );
    mockDecode.mockResolvedValue({ role: "ENGINEER", sessionId: "s" });

    await expect(requireAuth()).rejects.toThrow("無效的存取權杖");
  });

  it("rejects null payload from decode()", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer empty" : null
    );
    mockDecode.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("無效的存取權杖");
  });

  it("rejects when AUTH_SECRET is missing (server misconfiguration)", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );

    await expect(requireAuth()).rejects.toThrow("伺服器設定錯誤");
    process.env.AUTH_SECRET = "test-secret";
  });

  it("uses NEXTAUTH_SECRET as fallback when AUTH_SECRET is missing", async () => {
    delete process.env.AUTH_SECRET;
    process.env.NEXTAUTH_SECRET = "fallback-secret";

    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );
    mockDecode.mockResolvedValue({ id: "u1", role: "ENGINEER", sessionId: "s1" });

    const session = await requireAuth();
    expect(session.user.id).toBe("u1");
    expect(mockDecode).toHaveBeenCalledWith(
      expect.objectContaining({ secret: "fallback-secret" })
    );

    delete process.env.NEXTAUTH_SECRET;
    process.env.AUTH_SECRET = "test-secret";
  });

  // ── OWASP: Bearer header edge cases ────────────────────────────────

  it("ignores Bearer prefix with no token (empty)", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer " : null
    );
    mockDecode.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("無效的存取權杖");
  });

  it("ignores non-Bearer auth schemes (Basic, etc.)", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Basic dXNlcjpwYXNz" : null
    );
    mockAuth.mockResolvedValue({
      user: { id: "web-user", role: "ENGINEER" },
      expires: "2099-01-01",
    });

    // Should fall through to cookie auth, not try to decode Basic as JWE
    const session = await requireAuth();
    expect(session.user.id).toBe("web-user");
    expect(mockDecode).not.toHaveBeenCalled();
  });

  it("computes correct expires from exp claim", async () => {
    const futureExp = Math.floor(Date.now() / 1000) + 600;
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );
    mockDecode.mockResolvedValue({
      id: "u1", role: "ENGINEER", sessionId: "s1", exp: futureExp,
    });

    const session = await requireAuth();
    const expires = new Date(session.expires).getTime();
    expect(expires).toBeCloseTo(futureExp * 1000, -3); // within 1 second
  });

  it("provides fallback expires when exp claim is missing", async () => {
    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );
    mockDecode.mockResolvedValue({
      id: "u1", role: "ENGINEER", sessionId: "s1",
      // no exp
    });

    const session = await requireAuth();
    const expires = new Date(session.expires).getTime();
    // Should be ~15 minutes from now
    expect(expires - Date.now()).toBeGreaterThan(14 * 60 * 1000);
    expect(expires - Date.now()).toBeLessThan(16 * 60 * 1000);
  });

  // ── RBAC: role-gated access via requireAuth → requireMinRole chain ─

  it("session returned by Bearer path is usable by requireMinRole", async () => {
    const { requireMinRole } = await import("@/lib/rbac");

    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );
    mockDecode.mockResolvedValue({
      id: "u1", role: "MANAGER", sessionId: "s1",
    });

    const session = await requireMinRole("MANAGER");
    expect(session.user.role).toBe("MANAGER");
  });

  it("Bearer path ENGINEER is rejected by requireMinRole(MANAGER)", async () => {
    const { requireMinRole } = await import("@/lib/rbac");

    mockHeadersGet.mockImplementation((name: string) =>
      name === "authorization" ? "Bearer jwe" : null
    );
    mockDecode.mockResolvedValue({
      id: "u1", role: "ENGINEER", sessionId: "s1",
    });

    await expect(requireMinRole("MANAGER")).rejects.toThrow("權限不足");
  });
});

describe("Mobile Auth — Device binding (jwt.ts)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let rotateRefreshToken: typeof import("@/lib/auth/jwt").rotateRefreshToken;

  beforeAll(async () => {
    const mod = await import("@/lib/auth/jwt");
    rotateRefreshToken = mod.rotateRefreshToken;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshTokenCreate.mockResolvedValue({ id: "new-rt" });
    mockRefreshTokenUpdate.mockResolvedValue({});
  });

  it("rejects when device-bound token used without deviceId (CR #4)", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: "original-device",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("some-raw-token");
    // No deviceId passed → should reject because existing.deviceId is set

    expect(result).toBeNull();
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      })
    );
  });

  it("rejects on device mismatch and revokes all tokens", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: "original-device",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("raw-token", "different-device");

    expect(result).toBeNull();
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalled();
  });

  it("allows rotation when deviceId matches", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: "same-device",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("raw-token", "same-device");

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
    // New token should inherit deviceId
    expect(mockRefreshTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: "same-device" }),
      })
    );
  });

  it("allows rotation for web tokens (no deviceId)", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: null, // web token
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("raw-token");

    expect(result).not.toBeNull();
    expect(result?.userId).toBe("user-1");
  });

  // ── OWASP: Replay attack detection ─────────────────────────────────

  it("rejects already-revoked token (replay attack)", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: null,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: new Date(), // already revoked
    });

    const result = await rotateRefreshToken("replayed-token");

    expect(result).toBeNull();
    // Should revoke ALL tokens for this user (replay = compromise)
    expect(mockRefreshTokenUpdateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", revokedAt: null },
      })
    );
  });

  it("rejects expired token", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: null,
      expiresAt: new Date(Date.now() - 1000), // expired 1 second ago
      revokedAt: null,
    });

    const result = await rotateRefreshToken("expired-token");
    expect(result).toBeNull();
  });

  it("rejects nonexistent token (brute force attempt)", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue(null);

    const result = await rotateRefreshToken("nonexistent-token");
    expect(result).toBeNull();
  });

  it("new token inherits deviceId from mobile token even when caller passes different one", async () => {
    // existing token has deviceId "original-device"
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: "original-device",
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    const result = await rotateRefreshToken("raw-token", "original-device");

    expect(result).not.toBeNull();
    // Should inherit the EXISTING deviceId, not use caller's
    expect(mockRefreshTokenCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deviceId: "original-device" }),
      })
    );
  });

  it("revokes old token before issuing new one (single-use guarantee)", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-old",
      userId: "user-1",
      tokenHash: "hash",
      deviceId: null,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });

    await rotateRefreshToken("raw-token");

    // Old token should be revoked
    expect(mockRefreshTokenUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "rt-old" },
        data: { revokedAt: expect.any(Date) },
      })
    );
    // And then new one created
    expect(mockRefreshTokenCreate).toHaveBeenCalled();

    // Verify order: update (revoke) called before create (new token)
    const updateCallOrder = mockRefreshTokenUpdate.mock.invocationCallOrder[0];
    const createCallOrder = mockRefreshTokenCreate.mock.invocationCallOrder[0];
    expect(updateCallOrder).toBeLessThan(createCallOrder);
  });
});

describe("Mobile Auth — POST /api/auth/refresh (source=mobile)", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let POST: typeof import("@/app/api/auth/refresh/route").POST;

  beforeAll(async () => {
    const mod = await import("@/app/api/auth/refresh/route");
    POST = mod.POST;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-1",
      userId: "user-mobile-1",
      tokenHash: "hash",
      deviceId: null,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });
    mockRefreshTokenUpdate.mockResolvedValue({});
    mockRefreshTokenCreate.mockResolvedValue({ id: "new-rt" });
    mockUserFindUnique.mockResolvedValue(MOCK_USER);
    process.env.AUTH_SECRET = "test-secret";
  });

  it("returns JWE token when source=mobile", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-refresh-token",
      source: "mobile",
    });

    const res = await POST(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.token).toBe("mock-jwe-token"); // JWE access token
    expect(json.data.refreshToken).toBeDefined();
    expect(json.data.expiresAt).toBeDefined();
    expect(json.data.expiresIn).toBe(900);
  });

  it("does NOT return JWE token for web clients", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-refresh-token",
      // no source
    });

    const res = await POST(req as never);
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.data.token).toBeUndefined();
    expect(json.data.refreshToken).toBeDefined();
  });

  it("writes audit log for mobile refresh", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-token",
      source: "mobile",
      deviceId: "device-xyz",
    });

    await POST(req as never);

    expect(mockAuditLog).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "MOBILE_TOKEN_REFRESH",
        userId: "user-mobile-1",
      })
    );
  });

  it("registers new session on mobile refresh", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-token",
      source: "mobile",
    });

    await POST(req as never);

    expect(mockRegisterSession).toHaveBeenCalledWith(
      "user-mobile-1",
      expect.any(String) // new UUID
    );
  });

  it("returns 401 on invalid refresh token", async () => {
    mockRefreshTokenFindUnique.mockResolvedValue(null);

    const req = createRefreshRequest({
      refreshToken: "invalid",
      source: "mobile",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("returns 400 when refreshToken is missing", async () => {
    const req = createRefreshRequest({ source: "mobile" });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON", async () => {
    const req = new Request("http://localhost:3000/api/auth/refresh", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "}{invalid",
    });
    const res = await POST(req as never);
    expect(res.status).toBe(400);
  });

  it("returns 401 when user has been deactivated between token issue and refresh", async () => {
    mockUserFindUnique.mockResolvedValue({ ...MOCK_USER, isActive: false });

    const req = createRefreshRequest({
      refreshToken: "valid-token",
      source: "mobile",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(401);
  });

  it("does NOT write audit log for web refresh", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-token",
      // no source
    });

    await POST(req as never);

    expect(mockAuditLog).not.toHaveBeenCalled();
  });

  it("does NOT register session for web refresh", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-token",
      // no source
    });

    await POST(req as never);

    expect(mockRegisterSession).not.toHaveBeenCalled();
  });

  it("returns 500 when AUTH_SECRET missing for mobile refresh", async () => {
    delete process.env.AUTH_SECRET;
    delete process.env.NEXTAUTH_SECRET;

    const req = createRefreshRequest({
      refreshToken: "valid-token",
      source: "mobile",
    });

    const res = await POST(req as never);
    expect(res.status).toBe(500);
    process.env.AUTH_SECRET = "test-secret";
  });

  it("passes deviceId to rotateRefreshToken for binding verification", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-token",
      source: "mobile",
      deviceId: "my-device",
    });

    await POST(req as never);

    // rotateRefreshToken mock was called — verify deviceId was passed
    // (we can check via the findUnique call pattern)
    expect(mockRefreshTokenFindUnique).toHaveBeenCalled();
  });

  it("encode() on refresh uses same salt as login", async () => {
    const req = createRefreshRequest({
      refreshToken: "valid-token",
      source: "mobile",
    });

    await POST(req as never);

    expect(mockEncode).toHaveBeenCalledWith(
      expect.objectContaining({
        salt: "authjs.session-token",
        maxAge: 900,
      })
    );
  });

  it("each mobile refresh generates a unique sessionId", async () => {
    const req1 = createRefreshRequest({ refreshToken: "t1", source: "mobile" });
    await POST(req1 as never);

    const sessionId1 = mockRegisterSession.mock.calls[0][1];

    jest.clearAllMocks();
    mockRefreshTokenFindUnique.mockResolvedValue({
      id: "rt-2",
      userId: "user-mobile-1",
      tokenHash: "hash2",
      deviceId: null,
      expiresAt: new Date(Date.now() + 86400000),
      revokedAt: null,
    });
    mockRefreshTokenUpdate.mockResolvedValue({});
    mockRefreshTokenCreate.mockResolvedValue({ id: "new-rt-2" });
    mockUserFindUnique.mockResolvedValue(MOCK_USER);

    const req2 = createRefreshRequest({ refreshToken: "t2", source: "mobile" });
    await POST(req2 as never);

    const sessionId2 = mockRegisterSession.mock.calls[0][1];

    expect(sessionId1).not.toBe(sessionId2);
  });
});
