/**
 * @jest-environment node
 */
/**
 * TDD-1: Password management API route tests — Closes #555
 *
 * Routes covered:
 *   POST /api/auth/change-password
 *   POST /api/auth/reset-password
 *   POST /api/admin/generate-reset-token
 *
 * TDD red phase: tests written first to define expected behaviour.
 */

import { createMockRequest } from "../utils/test-utils.tsx";

// ── Shared mock factories ──────────────────────────────────────────────

const mockUser = {
  findUnique: jest.fn(),
  update: jest.fn(),
};
const mockPasswordHistory = {
  findMany: jest.fn(),
  create: jest.fn(),
};
const mockPasswordResetToken = {
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  updateMany: jest.fn(),
};
const mockAuditLog = {
  create: jest.fn(),
};
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: mockUser,
    passwordHistory: mockPasswordHistory,
    passwordResetToken: mockPasswordResetToken,
    auditLog: mockAuditLog,
    $transaction: (...args: unknown[]) => mockTransaction(...args),
  },
}));

const mockCompare = jest.fn();
const mockHash = jest.fn();
jest.mock("bcryptjs", () => ({
  compare: (...a: unknown[]) => mockCompare(...a),
  hash: (...a: unknown[]) => mockHash(...a),
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

jest.mock("@/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("@/lib/get-client-ip", () => ({
  getClientIp: jest.fn().mockReturnValue("127.0.0.1"),
}));

jest.mock("@/services/audit-service", () => ({
  AuditService: jest.fn().mockImplementation(() => ({
    log: jest.fn().mockResolvedValue(undefined),
  })),
}));

jest.mock("@/lib/session-cache", () => ({
  getCachedSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

// ── Test data ──────────────────────────────────────────────────────────

const MEMBER_SESSION = {
  user: { id: "user-1", name: "Alice", email: "alice@example.com", role: "MEMBER" },
  expires: "2099-01-01",
};

const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@example.com", role: "MANAGER" },
  expires: "2099-01-01",
};

const EXISTING_USER = {
  id: "user-1",
  name: "Alice",
  email: "alice@example.com",
  role: "MEMBER",
  password: "$2a$10$existinghash",
  isActive: true,
};

const STRONG_PASSWORD = "NewStr0ng!Pass@2024";

// ========================================================================
// POST /api/auth/change-password
// ========================================================================

describe("POST /api/auth/change-password", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockUser.findUnique.mockResolvedValue(EXISTING_USER);
    mockCompare.mockResolvedValue(true);
    mockHash.mockResolvedValue("$2a$10$newhash");
    mockPasswordHistory.findMany.mockResolvedValue([]);
    mockTransaction.mockResolvedValue([]);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "old", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", { method: "POST" });
    // Override json() to throw (simulates invalid JSON)
    (req.json as jest.Mock).mockRejectedValue(new SyntaxError("Unexpected token"));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 400 when currentPassword is missing", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is missing", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "OldPass123!" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword equals currentPassword", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: STRONG_PASSWORD, newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("不得與目前密碼相同");
  });

  it("returns 400 when newPassword does not meet policy", async () => {
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "OldPass123!", newPassword: "weak" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 404 when user not found in DB", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "OldPass123!", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when current password is incorrect", async () => {
    mockCompare.mockResolvedValue(false);
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "WrongPass1!", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("目前密碼不正確");
  });

  it("returns 400 when new password matches recent password history", async () => {
    // First compare call = currentPassword check (true)
    // Second compare call = history check (true = matches history)
    mockCompare
      .mockResolvedValueOnce(true)  // currentPassword valid
      .mockResolvedValueOnce(true); // matches history entry
    mockPasswordHistory.findMany.mockResolvedValue([
      { hash: "$2a$10$oldhash1" },
    ]);
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "OldPass123!", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("最近");
  });

  it("returns 200 and updates password on success", async () => {
    // All compare calls for history check return false (no match)
    mockCompare
      .mockResolvedValueOnce(true)   // currentPassword valid
      .mockResolvedValueOnce(false); // no history match
    mockPasswordHistory.findMany.mockResolvedValue([
      { hash: "$2a$10$oldhash1" },
    ]);
    const { POST } = await import("@/app/api/auth/change-password/route");
    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "OldPass123!", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockHash).toHaveBeenCalledWith(STRONG_PASSWORD, 12);
  });
});

// ========================================================================
// POST /api/auth/reset-password
// ========================================================================

describe("POST /api/auth/reset-password", () => {
  const VALID_TOKEN = {
    id: "token-1",
    userId: "user-1",
    token: "123456",
    usedAt: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min from now
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockUser.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      isActive: true,
    });
    mockPasswordResetToken.findFirst.mockResolvedValue(VALID_TOKEN);
    mockHash.mockResolvedValue("$2a$12$newhash");
    mockTransaction.mockResolvedValue([]);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", { method: "POST" });
    (req.json as jest.Mock).mockRejectedValue(new SyntaxError("Unexpected token"));
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 400 when email is missing", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { token: "123456", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 400 when token is missing", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "alice@example.com", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when newPassword is missing", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "alice@example.com", token: "123456" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 (generic) when user not found — prevents email enumeration", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "unknown@example.com", token: "123456", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("InvalidTokenError");
    // Should NOT reveal whether email exists
    expect(body.message).not.toContain("使用者不存在");
  });

  it("returns 400 when user is inactive", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: "user-1",
      name: "Alice",
      isActive: false,
    });
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "alice@example.com", token: "123456", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("InvalidTokenError");
  });

  it("returns 400 when OTP token is invalid or expired", async () => {
    mockPasswordResetToken.findFirst.mockResolvedValue(null);
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "alice@example.com", token: "000000", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("InvalidTokenError");
  });

  it("returns 400 when new password does not meet policy", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "alice@example.com", token: "123456", newPassword: "weak" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 200 and resets password on success", async () => {
    const { POST } = await import("@/app/api/auth/reset-password/route");
    const req = createMockRequest("/api/auth/reset-password", {
      method: "POST",
      body: { email: "alice@example.com", token: "123456", newPassword: STRONG_PASSWORD },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.message).toContain("成功重設");
    expect(mockTransaction).toHaveBeenCalled();
    expect(mockHash).toHaveBeenCalledWith(STRONG_PASSWORD, 12);
  });
});

// ========================================================================
// POST /api/admin/generate-reset-token
// ========================================================================

describe("POST /api/admin/generate-reset-token", () => {
  const TARGET_USER = {
    id: "target-1",
    name: "Bob",
    email: "bob@example.com",
    isActive: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockUser.findUnique.mockResolvedValue(TARGET_USER);
    mockPasswordResetToken.updateMany.mockResolvedValue({ count: 0 });
    mockPasswordResetToken.create.mockResolvedValue({
      id: "token-1",
      token: "654321",
      expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "target-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it("returns 403 when user is not MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "target-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it("returns 400 when request body is not valid JSON", async () => {
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", { method: "POST" });
    (req.json as jest.Mock).mockRejectedValue(new SyntaxError("Unexpected token"));
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 when userId is missing", async () => {
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: {},
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("ValidationError");
  });

  it("returns 404 when target user does not exist", async () => {
    mockUser.findUnique.mockResolvedValue(null);
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "nonexistent" },
    });
    const res = await POST(req);
    expect(res.status).toBe(404);
  });

  it("returns 400 when target user is inactive", async () => {
    mockUser.findUnique.mockResolvedValue({ ...TARGET_USER, isActive: false });
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "target-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("停用");
  });

  it("invalidates existing unused tokens before generating new one", async () => {
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "target-1" },
    });
    await POST(req);
    expect(mockPasswordResetToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "target-1",
          usedAt: null,
        }),
      })
    );
  });

  it("returns 200 with OTP token on success", async () => {
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "target-1" },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.token).toBeDefined();
    expect(body.data.expiresAt).toBeDefined();
    expect(body.data.expiresInMinutes).toBe(30);
    expect(body.data.userName).toBe("Bob");
  });

  it("generates a 6-digit numeric OTP", async () => {
    const { POST } = await import("@/app/api/admin/generate-reset-token/route");
    const req = createMockRequest("/api/admin/generate-reset-token", {
      method: "POST",
      body: { userId: "target-1" },
    });
    await POST(req);
    // Verify the token created in DB is a 6-digit string
    const createCall = mockPasswordResetToken.create.mock.calls[0][0];
    expect(createCall.data.token).toMatch(/^\d{6}$/);
  });
});
