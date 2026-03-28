/**
 * @jest-environment node
 */
/**
 * API route tests: /api/tasks and /api/tasks/[id]
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mocks (inline factories — no circular require) ────────────────────────
// These are defined before jest.mock so the factory can close over them.
// jest.mock is hoisted, but the factory function runs lazily at import time,
// so the variables are already initialised by then.
const mockTask = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
};
const mockTaskChange = { create: jest.fn() };
const mockTaskActivity = { create: jest.fn() };
const mockAuditLog = { create: jest.fn() };
// $transaction is shared across TaskService and ChangeTrackingService
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    taskChange: mockTaskChange,
    taskActivity: mockTaskActivity,
    auditLog: mockAuditLog,
    $transaction: mockTransaction,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...args: unknown[]) => mockGetServerSession(...args) }));

// ── Session helpers ───────────────────────────────────────────────────────
const MEMBER_SESSION = {
  user: { id: "user-1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099-01-01",
};

const MOCK_TASK = {
  id: "task-1",
  title: "Test Task",
  status: "TODO",
  priority: "P2",
  category: "PLANNED",
  primaryAssignee: null,
  backupAssignee: null,
  creator: { id: "user-1", name: "Test" },
  monthlyGoal: null,
  subTasks: [],
  deliverables: [],
  _count: { subTasks: 0, comments: 0 },
  dueDate: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

// ── GET /api/tasks ────────────────────────────────────────────────────────
describe("GET /api/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockTask.findMany.mockResolvedValue([MOCK_TASK]);
  });

  it("returns task list when authenticated", async () => {
    mockTask.count.mockResolvedValue(1);
    const { GET } = await import("@/app/api/tasks/route");
    const req = createMockRequest("/api/tasks");
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items[0].id).toBe("task-1");
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("passes assignee filter to prisma", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { assignee: "user-1" } }));
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ OR: expect.any(Array) }) })
    );
  });

  it("resolves assignee=me to session userId", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { assignee: "me" } }));
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            expect.objectContaining({ primaryAssigneeId: MEMBER_SESSION.user.id }),
          ]),
        }),
      })
    );
  });

  it("passes status filter to prisma", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { status: "TODO" } }));
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "TODO" }) })
    );
  });

  it("returns 500 on database error", async () => {
    mockTask.findMany.mockRejectedValue(new Error("DB Error"));
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(500);
  });
});

// ── POST /api/tasks ───────────────────────────────────────────────────────
describe("POST /api/tasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockTask.create.mockResolvedValue(MOCK_TASK);
  });

  it("creates task and returns 201", async () => {
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(createMockRequest("/api/tasks", { method: "POST", body: { title: "New Task" } }));
    expect(res.status).toBe(201);
  });

  it("returns 400 when title missing", async () => {
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(createMockRequest("/api/tasks", { method: "POST", body: {} }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(createMockRequest("/api/tasks", { method: "POST", body: { title: "T" } }));
    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockTask.create.mockRejectedValue(new Error("DB Error"));
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(createMockRequest("/api/tasks", { method: "POST", body: { title: "T" } }));
    expect(res.status).toBe(500);
  });
});

// ── GET /api/tasks/[id] ───────────────────────────────────────────────────
describe("GET /api/tasks/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockTask.findUnique.mockResolvedValue(MOCK_TASK);
  });

  it("returns task detail", async () => {
    const { GET } = await import("@/app/api/tasks/[id]/route");
    const res = await GET(createMockRequest("/api/tasks/task-1"), { params: Promise.resolve({ id: "task-1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.id).toBe("task-1");
  });

  it("returns 404 when not found", async () => {
    mockTask.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tasks/[id]/route");
    const res = await GET(createMockRequest("/api/tasks/x"), { params: Promise.resolve({ id: "x" }) });
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tasks/[id]/route");
    const res = await GET(createMockRequest("/api/tasks/task-1"), { params: Promise.resolve({ id: "task-1" }) });
    expect(res.status).toBe(401);
  });
});

// ── PUT /api/tasks/[id] ───────────────────────────────────────────────────
describe("PUT /api/tasks/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    mockTask.findUnique.mockResolvedValue({ ...MOCK_TASK, primaryAssigneeId: "user-1", backupAssigneeId: null });
    mockTask.update.mockResolvedValue({ ...MOCK_TASK, title: "Updated" });
    mockTaskChange.create.mockResolvedValue({});
    // $transaction used by ChangeTrackingService.detectDelay/detectScopeChange
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { task: mockTask, taskActivity: mockTaskActivity, taskChange: mockTaskChange };
      return fn(tx);
    });
  });

  it("updates task and returns 200", async () => {
    const { PUT } = await import("@/app/api/tasks/[id]/route");
    const res = await PUT(
      createMockRequest("/api/tasks/task-1", { method: "PUT", body: { title: "Updated" } }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 404 when task not found", async () => {
    mockTask.findUnique.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/tasks/[id]/route");
    const res = await PUT(
      createMockRequest("/api/tasks/x", { method: "PUT", body: { title: "U" } }),
      { params: Promise.resolve({ id: "x" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PUT } = await import("@/app/api/tasks/[id]/route");
    const res = await PUT(
      createMockRequest("/api/tasks/task-1", { method: "PUT", body: {} }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("creates TaskChange when dueDate changes", async () => {
    mockTask.findUnique.mockResolvedValue({ ...MOCK_TASK, primaryAssigneeId: "user-1", backupAssigneeId: null, dueDate: new Date("2024-01-01T00:00:00.000Z") });
    mockTaskChange.create.mockResolvedValue({});
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      return fn({ task: mockTask, taskActivity: mockTaskActivity, taskChange: mockTaskChange });
    });
    const { PUT } = await import("@/app/api/tasks/[id]/route");
    await PUT(
      createMockRequest("/api/tasks/task-1", { method: "PUT", body: { dueDate: "2024-02-01T00:00:00.000Z", changedBy: "user-1" } }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(mockTaskChange.create).toHaveBeenCalled();
  });
});

const MANAGER_SESSION = {
  user: { id: "user-1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099-01-01",
};

// ── DELETE /api/tasks/[id] ────────────────────────────────────────────────
describe("DELETE /api/tasks/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockTask.findUnique.mockResolvedValue(MOCK_TASK);
    mockTask.delete.mockResolvedValue(MOCK_TASK);
    mockAuditLog.create.mockResolvedValue({});
  });

  it("deletes task and returns success", async () => {
    const { DELETE } = await import("@/app/api/tasks/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/tasks/task-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/tasks/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/tasks/task-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(401);
  });
});

// ── PATCH /api/tasks/[id] — status change ────────────────────────────────
describe("PATCH /api/tasks/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MEMBER_SESSION);
    // State machine: REVIEW → DONE is valid (MOCK_TASK default is TODO, override to REVIEW)
    mockTask.findUnique.mockResolvedValue({ ...MOCK_TASK, status: "REVIEW", primaryAssigneeId: "user-1", backupAssigneeId: null });
    mockTask.update.mockResolvedValue({ ...MOCK_TASK, status: "DONE" });
    mockTaskActivity.create.mockResolvedValue({});
    // $transaction receives a callback; simulate calling it with a tx proxy
    mockTransaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
      const tx = { task: mockTask, taskActivity: mockTaskActivity, taskChange: mockTaskChange };
      return fn(tx);
    });
  });

  it("updates status and returns 200", async () => {
    const { PATCH } = await import("@/app/api/tasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1", { method: "PATCH", body: { status: "DONE" } }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 400 when status missing", async () => {
    const { PATCH } = await import("@/app/api/tasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1", { method: "PATCH", body: {} }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/tasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1", { method: "PATCH", body: { status: "DONE" } }),
      { params: Promise.resolve({ id: "task-1" }) }
    );
    expect(res.status).toBe(401);
  });
});
