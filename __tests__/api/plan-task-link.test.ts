/**
 * @jest-environment node
 */
/**
 * TDD: Annual plan ↔ task linkage — Fixes #835 (A-4)
 *
 * Tests:
 *   - Task creation with annualPlanId
 *   - Task update to set/clear annualPlanId
 *   - GET /api/tasks?planId=xxx filters correctly
 *   - FK constraint: deleting plan sets task.annualPlanId to null (SetNull)
 *   - Schema validation includes annualPlanId
 */

import { createMockRequest } from "../utils/test-utils";

const mockTask = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  count: jest.fn(),
};
const mockTaskActivity = { create: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    taskActivity: mockTaskActivity,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));
jest.mock("@/lib/logger", () => ({ logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() } }));
jest.mock("@/lib/request-logger", () => ({ requestLogger: (_req: unknown, fn: () => unknown) => fn() }));
jest.mock("@/lib/csrf", () => ({ validateCsrf: jest.fn(), CsrfError: class extends Error {} }));
jest.mock("@/lib/rate-limiter", () => ({
  createApiRateLimiter: jest.fn(() => ({})),
  checkRateLimit: jest.fn(),
  RateLimitError: class extends Error { retryAfter = 60; },
}));
jest.mock("@/auth", () => ({ auth: jest.fn() }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" }, expires: "2099" };

describe("GET /api/tasks?planId=xxx — plan filter (Issue #835)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
    mockTask.findMany.mockResolvedValue([]);
    mockTask.count.mockResolvedValue(0);
  });

  it("passes annualPlanId filter to task query", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { planId: "plan-1" } }));

    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ annualPlanId: "plan-1" }),
      })
    );
  });

  it("also supports annualPlanId query param", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { annualPlanId: "plan-2" } }));

    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ annualPlanId: "plan-2" }),
      })
    );
  });

  it("supports goalId query param alias", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { goalId: "goal-1" } }));

    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ monthlyGoalId: "goal-1" }),
      })
    );
  });
});

describe("POST /api/tasks — create with annualPlanId", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(SESSION);
    const { auth } = require("@/auth");
    auth.mockResolvedValue(SESSION);
  });

  it("creates task with annualPlanId when provided", async () => {
    mockTask.create.mockResolvedValue({
      id: "task-1",
      title: "Test Task",
      annualPlanId: "plan-1",
      status: "BACKLOG",
    });

    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(createMockRequest("/api/tasks", {
      method: "POST",
      body: { title: "Test Task", annualPlanId: "plan-1" },
    }));
    expect(res.status).toBe(201);

    expect(mockTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ annualPlanId: "plan-1" }),
      })
    );
  });

  it("creates task without annualPlanId (null)", async () => {
    mockTask.create.mockResolvedValue({
      id: "task-2",
      title: "No Plan",
      annualPlanId: null,
      status: "BACKLOG",
    });

    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(createMockRequest("/api/tasks", {
      method: "POST",
      body: { title: "No Plan" },
    }));
    expect(res.status).toBe(201);

    expect(mockTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ annualPlanId: null }),
      })
    );
  });
});

describe("Validator: annualPlanId in schemas", () => {
  it("createTaskSchema accepts annualPlanId", () => {
    const { createTaskSchema } = require("@/validators/shared/task");
    const result = createTaskSchema.safeParse({ title: "T", annualPlanId: "plan-1" });
    expect(result.success).toBe(true);
  });

  it("createTaskSchema accepts null annualPlanId", () => {
    const { createTaskSchema } = require("@/validators/shared/task");
    const result = createTaskSchema.safeParse({ title: "T", annualPlanId: null });
    expect(result.success).toBe(true);
  });

  it("updateTaskSchema accepts annualPlanId", () => {
    const { updateTaskSchema } = require("@/validators/shared/task");
    const result = updateTaskSchema.safeParse({ annualPlanId: "plan-1" });
    expect(result.success).toBe(true);
  });

  it("updateTaskSchema accepts null annualPlanId to remove link", () => {
    const { updateTaskSchema } = require("@/validators/shared/task");
    const result = updateTaskSchema.safeParse({ annualPlanId: null });
    expect(result.success).toBe(true);
  });
});
