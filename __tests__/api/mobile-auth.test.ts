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
    mockIsLocked.mockResolvedValue(false);
    mockGetRemainingLockSeconds.mockResolvedValue(0);
    mockUserFindUnique.mockResolvedValue(MOCK_USER);
    mockCompare.mockResolvedValue(true);
    mockRefreshTokenCreate.mockResolvedValue({ id: "rt-1" });
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
    (JwtBlacklist.has as jest.Mock).mockReturnValue(true);

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
});
