/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #152 — RBAC: goals POST/PUT require MANAGER;
 * changeType must be validated as a Zod enum (DELAY | SCOPE_CHANGE).
 */

import { createMockRequest } from "../utils/test-utils";

// ── Shared prisma mock ─────────────────────────────────────────────────────
const mockMonthlyGoal = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockTask = { updateMany: jest.fn() };
const mockTaskChange = { create: jest.fn(), findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    monthlyGoal: mockMonthlyGoal,
    task: mockTask,
    taskChange: mockTaskChange,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Session fixtures ───────────────────────────────────────────────────────
const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};
const MEMBER_SESSION = {
  user: { id: "mem-1", name: "Member", email: "mem@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};

const MOCK_GOAL = {
  id: "goal-1",
  annualPlanId: "plan-1",
  month: 1,
  title: "January Goal",
  annualPlan: { id: "plan-1", title: "2024 Plan", year: 2024 },
  tasks: [],
  _count: { tasks: 0 },
  deliverables: [],
};

// ══════════════════════════════════════════════════════════════════════════
// Test 1 — POST /api/goals requires MANAGER role
// ══════════════════════════════════════════════════════════════════════════
describe("POST /api/goals — RBAC: requires MANAGER", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockMonthlyGoal.create.mockResolvedValue(MOCK_GOAL);
  });

  it("returns 201 when called by MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(
      createMockRequest("/api/goals", {
        method: "POST",
        body: { annualPlanId: "plan-1", month: 1, title: "January Goal" },
      })
    );
    expect(res.status).toBe(201);
  });

  it("returns 403 when called by MEMBER (non-manager)", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(
      createMockRequest("/api/goals", {
        method: "POST",
        body: { annualPlanId: "plan-1", month: 1, title: "January Goal" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/goals/route");
    const res = await POST(
      createMockRequest("/api/goals", {
        method: "POST",
        body: { annualPlanId: "plan-1", month: 1, title: "January Goal" },
      })
    );
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Test 2 — PUT /api/goals/[id] requires MANAGER role
// ══════════════════════════════════════════════════════════════════════════
describe("PUT /api/goals/[id] — RBAC: requires MANAGER", () => {
  const context = { params: Promise.resolve({ id: "goal-1" }) };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockMonthlyGoal.update.mockResolvedValue(MOCK_GOAL);
  });

  it("returns 200 when called by MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { PUT } = await import("@/app/api/goals/[id]/route");
    const res = await PUT(
      createMockRequest("/api/goals/goal-1", {
        method: "PUT",
        body: { title: "Updated Goal" },
      }),
      context
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when called by MEMBER (non-manager)", async () => {
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    const { PUT } = await import("@/app/api/goals/[id]/route");
    const res = await PUT(
      createMockRequest("/api/goals/goal-1", {
        method: "PUT",
        body: { title: "Updated Goal" },
      }),
      context
    );
    expect(res.status).toBe(403);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/goals/[id]/route");
    const res = await PUT(
      createMockRequest("/api/goals/goal-1", {
        method: "PUT",
        body: { title: "Updated Goal" },
      }),
      context
    );
    expect(res.status).toBe(401);
  });
});

// ══════════════════════════════════════════════════════════════════════════
// Test 3 — POST /api/tasks/[id]/changes validates changeType enum
// ══════════════════════════════════════════════════════════════════════════
describe("POST /api/tasks/[id]/changes — Zod changeType enum validation", () => {
  const context = { params: Promise.resolve({ id: "task-1" }) };

  const MOCK_CHANGE = {
    id: "change-1",
    taskId: "task-1",
    changeType: "DELAY",
    reason: "Deadline extended",
    oldValue: null,
    newValue: null,
    changedBy: "mgr-1",
    changedByUser: { id: "mgr-1", name: "Manager" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockTaskChange.create.mockResolvedValue(MOCK_CHANGE);
  });

  it("accepts valid changeType DELAY", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/changes", {
        method: "POST",
        body: { changeType: "DELAY", reason: "Deadline extended" },
      }),
      context
    );
    expect(res.status).toBe(201);
  });

  it("accepts valid changeType SCOPE_CHANGE", async () => {
    mockTaskChange.create.mockResolvedValue({ ...MOCK_CHANGE, changeType: "SCOPE_CHANGE" });
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/changes", {
        method: "POST",
        body: { changeType: "SCOPE_CHANGE", reason: "Scope updated" },
      }),
      context
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 for invalid changeType value", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/changes", {
        method: "POST",
        body: { changeType: "INVALID_TYPE", reason: "Some reason" },
      }),
      context
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when changeType is missing", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/changes", {
        method: "POST",
        body: { reason: "No type provided" },
      }),
      context
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when reason is missing", async () => {
    const { POST } = await import("@/app/api/tasks/[id]/changes/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/changes", {
        method: "POST",
        body: { changeType: "DELAY" },
      }),
      context
    );
    expect(res.status).toBe(400);
  });
});
