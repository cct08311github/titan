/**
 * @jest-environment node
 */
/**
 * User CRUD Enhancement tests — Issue #800 (AD-1)
 */

const mockAuthFn = jest.fn();
jest.mock("@/auth", () => ({ auth: (...args: unknown[]) => mockAuthFn(...args) }));

const mockUserFindMany = jest.fn().mockResolvedValue([]);
const mockUserFindUnique = jest.fn();
const mockUserCount = jest.fn();
const mockUserUpdate = jest.fn();
const mockUserCreate = jest.fn();
const mockTaskFindMany = jest.fn().mockResolvedValue([]);
const mockAuditCreate = jest.fn().mockResolvedValue({});

jest.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findMany: (...args: unknown[]) => mockUserFindMany(...args),
      findUnique: (...args: unknown[]) => mockUserFindUnique(...args),
      count: (...args: unknown[]) => mockUserCount(...args),
      update: (...args: unknown[]) => mockUserUpdate(...args),
      create: (...args: unknown[]) => mockUserCreate(...args),
    },
    task: { findMany: (...args: unknown[]) => mockTaskFindMany(...args) },
    auditLog: { create: (...args: unknown[]) => mockAuditCreate(...args) },
  },
}));

jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: () => ({}), checkRateLimit: jest.fn(),
  createLoginRateLimiter: () => ({}),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));

import { UserService } from "@/services/user-service";
import { ValidationError } from "@/services/errors";

describe("UserService.listUsers search", () => {
  const prisma = require("@/lib/prisma").prisma;
  const svc = new UserService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("should pass search filter to where clause", async () => {
    mockUserFindMany.mockResolvedValueOnce([]);
    await svc.listUsers({ search: "alice" });
    const call = mockUserFindMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.OR).toEqual([
      { name: { contains: "alice", mode: "insensitive" } },
      { email: { contains: "alice", mode: "insensitive" } },
    ]);
  });

  it("should pass role filter", async () => {
    mockUserFindMany.mockResolvedValueOnce([]);
    await svc.listUsers({ role: "MANAGER" });
    expect(mockUserFindMany.mock.calls[0][0].where.role).toBe("MANAGER");
  });
});

describe("UserService.suspendUser protections", () => {
  const prisma = require("@/lib/prisma").prisma;
  const svc = new UserService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it("should prevent disabling last MANAGER", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "u1", role: "MANAGER", isActive: true });
    mockUserCount.mockResolvedValueOnce(1); // only 1 active manager

    await expect(svc.suspendUser("u1")).rejects.toThrow("無法停用最後一位管理員帳號");
  });

  it("should allow disabling MANAGER when others exist", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "u1", role: "MANAGER", isActive: true });
    mockUserCount.mockResolvedValueOnce(2); // 2 active managers
    mockUserUpdate.mockResolvedValueOnce({ id: "u1", isActive: false, name: "A", email: "a@b.com", role: "MANAGER" });

    const result = await svc.suspendUser("u1");
    expect(result.isActive).toBe(false);
  });

  it("should allow disabling ENGINEER without restriction", async () => {
    mockUserFindUnique.mockResolvedValueOnce({ id: "u2", role: "ENGINEER", isActive: true });
    mockUserUpdate.mockResolvedValueOnce({ id: "u2", isActive: false, name: "B", email: "b@b.com", role: "ENGINEER" });

    const result = await svc.suspendUser("u2");
    expect(result.isActive).toBe(false);
  });
});

describe("UserService.getPendingTasks", () => {
  const prisma = require("@/lib/prisma").prisma;
  const svc = new UserService(prisma);

  it("should query pending tasks for user", async () => {
    mockTaskFindMany.mockResolvedValueOnce([
      { id: "t1", title: "Task 1", status: "IN_PROGRESS", dueDate: null },
    ]);
    const tasks = await svc.getPendingTasks("u1");
    expect(tasks).toHaveLength(1);
    expect(mockTaskFindMany.mock.calls[0][0].where.primaryAssigneeId).toBe("u1");
  });
});

describe("GET /api/users with search", () => {
  const { NextRequest } = require("next/server");
  let GET: Function;

  beforeAll(async () => {
    const mod = await import("@/app/api/users/route");
    GET = mod.GET;
  });

  beforeEach(() => jest.clearAllMocks());

  it("should pass search param to service", async () => {
    mockAuthFn.mockResolvedValue({ user: { id: "u1", role: "MANAGER" }, expires: "2099-01-01" });
    mockUserFindMany.mockResolvedValueOnce([]);

    const req = new NextRequest("http://localhost/api/users?search=alice&role=ENGINEER");
    await GET(req);

    const call = mockUserFindMany.mock.calls[0][0];
    expect(call.where.OR).toBeDefined();
    expect(call.where.role).toBe("ENGINEER");
  });
});
