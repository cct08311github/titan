/**
 * @jest-environment node
 */
/**
 * TDD: Tests written FIRST (RED) before implementation.
 * Issue #81: RBAC permission middleware
 */

import { NextRequest } from "next/server";
import { UnauthorizedError, ForbiddenError } from "@/services/errors";

// ── Mock next-auth ─────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Mock prisma ────────────────────────────────────────────────────────────
const mockPermissionFindFirst = jest.fn();
jest.mock("@/lib/prisma", () => ({
  prisma: {
    permission: {
      findFirst: (...args: unknown[]) => mockPermissionFindFirst(...args),
    },
  },
}));

// ── Import after mocks ─────────────────────────────────────────────────────
import {
  requireAuth,
  requireRole,
  requireOwnerOrManager,
  checkPermission,
} from "@/lib/rbac";

// ── Helpers ────────────────────────────────────────────────────────────────
function makeManagerSession(id = "manager-1") {
  return { user: { id, name: "Manager", email: "mgr@example.com", role: "MANAGER" }, expires: "2099-01-01" };
}

function makeEngineerSession(id = "engineer-1") {
  return { user: { id, name: "Engineer", email: "eng@example.com", role: "ENGINEER" }, expires: "2099-01-01" };
}

function makeFakeRequest(url = "http://localhost/api/test"): NextRequest {
  return {
    url,
    method: "GET",
    headers: new Headers(),
    json: jest.fn(),
  } as unknown as NextRequest;
}

// ── describe: requireAuth ──────────────────────────────────────────────────

describe("requireAuth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("returns session when user is authenticated", async () => {
    const session = makeEngineerSession();
    mockGetServerSession.mockResolvedValue(session);

    const result = await requireAuth();
    expect(result).toBe(session);
  });

  test("throws UnauthorizedError when no session exists", async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow(UnauthorizedError);
  });

  test("throws UnauthorizedError with 401-appropriate message", async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireAuth()).rejects.toThrow("未授權");
  });
});

// ── describe: requireRole ──────────────────────────────────────────────────

describe("requireRole", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows MANAGER to access manager-only route", async () => {
    mockGetServerSession.mockResolvedValue(makeManagerSession());

    const session = await requireRole("MANAGER");
    expect(session.user.role).toBe("MANAGER");
  });

  test("rejects ENGINEER from manager-only route with ForbiddenError", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());

    await expect(requireRole("MANAGER")).rejects.toThrow(ForbiddenError);
  });

  test("allows any authenticated user to access general route (ENGINEER role)", async () => {
    mockGetServerSession.mockResolvedValue(makeEngineerSession());

    const session = await requireRole("ENGINEER");
    expect(session.user.role).toBe("ENGINEER");
  });

  test("rejects unauthenticated request with UnauthorizedError", async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireRole("MANAGER")).rejects.toThrow(UnauthorizedError);
  });

  test("rejects unauthenticated request before checking role (401 not 403)", async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireRole("MANAGER")).rejects.toThrow(UnauthorizedError);
    // Ensure it's UnauthorizedError specifically, not ForbiddenError
    await expect(requireRole("MANAGER")).rejects.not.toThrow(ForbiddenError);
  });
});

// ── describe: requireOwnerOrManager ───────────────────────────────────────

describe("requireOwnerOrManager", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("allows task owner to access their own task", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);

    const result = await requireOwnerOrManager("engineer-1");
    expect(result).toBe(session);
  });

  test("allows MANAGER to access any task", async () => {
    const session = makeManagerSession("manager-1");
    mockGetServerSession.mockResolvedValue(session);

    // Manager accessing a task owned by a different user
    const result = await requireOwnerOrManager("engineer-99");
    expect(result.user.role).toBe("MANAGER");
  });

  test("rejects ENGINEER from accessing another user's task with ForbiddenError", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);

    await expect(requireOwnerOrManager("engineer-2")).rejects.toThrow(ForbiddenError);
  });

  test("rejects unauthenticated request with UnauthorizedError", async () => {
    mockGetServerSession.mockResolvedValue(null);

    await expect(requireOwnerOrManager("engineer-1")).rejects.toThrow(UnauthorizedError);
  });
});

// ── describe: checkPermission ──────────────────────────────────────────────

describe("checkPermission", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("MANAGER can view all team data (VIEW_TEAM scope)", async () => {
    const session = makeManagerSession("manager-1");
    mockGetServerSession.mockResolvedValue(session);
    mockPermissionFindFirst.mockResolvedValue(null); // no explicit Permission row needed

    const result = await checkPermission("manager-1", "VIEW_TEAM");
    expect(result).toBe(true);
  });

  test("ENGINEER cannot view team data by default (VIEW_TEAM scope)", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);
    // No permission record for this engineer
    mockPermissionFindFirst.mockResolvedValue(null);

    const result = await checkPermission("engineer-1", "VIEW_TEAM");
    expect(result).toBe(false);
  });

  test("ENGINEER with VIEW_TEAM permission can view team data", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);
    // Active VIEW_TEAM permission exists
    mockPermissionFindFirst.mockResolvedValue({
      id: "perm-1",
      granteeId: "engineer-1",
      permType: "VIEW_TEAM",
      isActive: true,
      expiresAt: null,
    });

    const result = await checkPermission("engineer-1", "VIEW_TEAM");
    expect(result).toBe(true);
  });

  test("respects dynamic Permission table entries — expired permission is rejected", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);
    // Expired permission should not be found (query filters it out)
    mockPermissionFindFirst.mockResolvedValue(null);

    const result = await checkPermission("engineer-1", "VIEW_TEAM");
    expect(result).toBe(false);
  });

  test("ENGINEER can always view own data (VIEW_OWN scope)", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);

    const result = await checkPermission("engineer-1", "VIEW_OWN");
    expect(result).toBe(true);
  });

  test("ENGINEER cannot view other user data with VIEW_OWN scope", async () => {
    const session = makeEngineerSession("engineer-1");
    mockGetServerSession.mockResolvedValue(session);

    // engineer-1 trying to check VIEW_OWN for engineer-2
    const result = await checkPermission("engineer-2", "VIEW_OWN");
    expect(result).toBe(false);
  });
});
