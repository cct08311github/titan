/**
 * @jest-environment node
 */
/**
 * TDD: Password expiry enforcement — Fixes #834 (AU-5)
 *
 * Tests:
 *   - isPasswordExpired: 90 days boundary
 *   - daysUntilExpiry: countdown calculation
 *   - Change-password API: rejects last 5 passwords
 *   - Change-password API: updates passwordChangedAt
 *   - Session includes passwordChangedAt for client warning
 */

describe("password-expiry module", () => {
  // Use direct import since there's no prisma dependency
  const { isPasswordExpired, daysUntilExpiry, PASSWORD_MAX_AGE_DAYS } = require("@/lib/password-expiry");

  it("returns true when passwordChangedAt is null", () => {
    expect(isPasswordExpired(null)).toBe(true);
  });

  it("returns false when password changed today", () => {
    expect(isPasswordExpired(new Date())).toBe(false);
  });

  it("returns true when password changed exactly 90 days ago + 1ms", () => {
    const expired = new Date(Date.now() - PASSWORD_MAX_AGE_DAYS * 24 * 60 * 60 * 1000 - 1);
    expect(isPasswordExpired(expired)).toBe(true);
  });

  it("returns false when password changed 89 days ago", () => {
    const notExpired = new Date(Date.now() - 89 * 24 * 60 * 60 * 1000);
    expect(isPasswordExpired(notExpired)).toBe(false);
  });

  it("daysUntilExpiry returns 0 when null", () => {
    expect(daysUntilExpiry(null)).toBe(0);
  });

  it("daysUntilExpiry returns correct countdown", () => {
    // Changed 83 days ago → 7 days until expiry
    const changedAt = new Date(Date.now() - 83 * 24 * 60 * 60 * 1000);
    expect(daysUntilExpiry(changedAt)).toBe(7);
  });

  it("daysUntilExpiry returns 0 when expired", () => {
    const expired = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000);
    expect(daysUntilExpiry(expired)).toBe(0);
  });

  it("daysUntilExpiry returns 90 when changed just now", () => {
    const justNow = new Date();
    expect(daysUntilExpiry(justNow)).toBe(90);
  });
});

describe("POST /api/auth/change-password — password history", () => {
  const mockUser = { findUnique: jest.fn(), update: jest.fn() };
  const mockPasswordHistory = { findMany: jest.fn(), create: jest.fn() };
  const mockTransaction = jest.fn();
  const mockAuditLog = { create: jest.fn() };

  jest.mock("@/lib/prisma", () => ({
    prisma: {
      user: mockUser,
      passwordHistory: mockPasswordHistory,
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

  jest.mock("next-auth", () => ({
    getServerSession: jest.fn(),
  }));

  jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn() } }));
  jest.mock("@/auth", () => ({ auth: jest.fn() }));

  const { createMockRequest } = require("../utils/test-utils");

  const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" }, expires: "2099" };

  beforeEach(() => {
    jest.clearAllMocks();
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("rejects if new password matches one of last 5 passwords", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: "u1",
      password: "$2a$12$current",
      passwordChangedAt: new Date(),
    });
    // Current password check passes
    mockCompare.mockImplementation(async (input: string, hash: string) => {
      if (hash === "$2a$12$current") return true; // current password check
      if (hash === "$2a$12$old3") return true; // matches old password #3
      return false;
    });
    mockPasswordHistory.findMany.mockResolvedValue([
      { hash: "$2a$12$old1" },
      { hash: "$2a$12$old2" },
      { hash: "$2a$12$old3" },
      { hash: "$2a$12$old4" },
      { hash: "$2a$12$old5" },
    ]);

    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "Current1!", newPassword: "MatchesOld3!" },
    });

    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("5");
  });

  it("updates passwordChangedAt and records to PasswordHistory on success", async () => {
    mockUser.findUnique.mockResolvedValue({
      id: "u1",
      password: "$2a$12$current",
      passwordChangedAt: new Date(),
    });
    mockCompare.mockResolvedValue(false);
    // First call is current password check (true), rest are history checks (false)
    mockCompare
      .mockResolvedValueOnce(true) // current password ok
      .mockResolvedValue(false); // no history match
    mockPasswordHistory.findMany.mockResolvedValue([]);
    mockHash.mockResolvedValue("$2a$12$newHash");
    mockTransaction.mockResolvedValue([]);

    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "Current@1234", newPassword: "NewSecure@123" },
    });

    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(req);
    expect(res.status).toBe(200);

    // Verify transaction was called (creates password history + updates user)
    expect(mockTransaction).toHaveBeenCalled();
    const txCalls = mockTransaction.mock.calls[0][0];
    expect(txCalls).toHaveLength(2); // passwordHistory.create + user.update
  });

  it("returns 401 when not authenticated", async () => {
    const { auth } = require("@/auth");
    auth.mockResolvedValue(null);

    const req = createMockRequest("/api/auth/change-password", {
      method: "POST",
      body: { currentPassword: "x", newPassword: "y" },
    });

    const { POST } = await import("@/app/api/auth/change-password/route");
    const res = await POST(req);
    expect(res.status).toBe(401);
  });
});
