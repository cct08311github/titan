/**
 * @jest-environment node
 */
/**
 * Layer 1.5 Integration Tests — Section C: Permission / RBAC Combinations
 *
 * Tests that role-based access control is correctly enforced end-to-end
 * across API route handlers, covering manager vs engineer access patterns.
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockTask = { findMany: jest.fn(), create: jest.fn(), findUnique: jest.fn(), count: jest.fn().mockResolvedValue(0) };
const mockUser = { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() };
const mockKPI = { findMany: jest.fn(), create: jest.fn() };
const mockTimeEntry = { findMany: jest.fn(), create: jest.fn() };
const mockAuditLog = { create: jest.fn() };
const mockPermission = { findFirst: jest.fn() };
const mockTaskActivity = { create: jest.fn() };
const mockTaskChange = { create: jest.fn() };
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    user: mockUser,
    kPI: mockKPI,
    timeEntry: mockTimeEntry,
    auditLog: mockAuditLog,
    permission: mockPermission,
    taskActivity: mockTaskActivity,
    taskChange: mockTaskChange,
    $transaction: mockTransaction,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// ── Session fixtures ───────────────────────────────────────────────────────
const ENGINEER_SESSION = {
  user: { id: "eng-1", name: "Engineer", email: "eng@test.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@test.com", role: "MANAGER" },
  expires: "2099-01-01",
};

const TASK_1 = {
  id: "t-1",
  title: "Engineer Task",
  status: "TODO",
  priority: "P2",
  category: "PLANNED",
  primaryAssigneeId: "eng-1",
  backupAssigneeId: null,
  primaryAssignee: { id: "eng-1", name: "Engineer", avatar: null },
  backupAssignee: null,
  creator: { id: "eng-1", name: "Engineer" },
  monthlyGoal: null,
  subTasks: [],
  deliverables: [],
  _count: { subTasks: 0, comments: 0 },
  dueDate: null,
  createdAt: new Date("2024-01-01"),
  updatedAt: new Date("2024-01-01"),
};

const TASK_2 = {
  ...TASK_1,
  id: "t-2",
  title: "Another User Task",
  primaryAssigneeId: "other-user",
  primaryAssignee: { id: "other-user", name: "Other", avatar: null },
};

// ── C1. Manager sees all tasks ─────────────────────────────────────────────
describe("C1: Manager receives all tasks without scope restriction", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockTask.findMany.mockResolvedValue([TASK_1, TASK_2]);
  });

  it("GET /api/tasks returns 200 with multiple tasks for manager", async () => {
    mockTask.count.mockResolvedValue(2);
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(2);
  });

  it("manager can filter by any assignee userId", async () => {
    mockTask.findMany.mockResolvedValue([TASK_2]);
    mockTask.count.mockResolvedValue(1);
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(
      createMockRequest("/api/tasks", { searchParams: { assignee: "other-user" } })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items[0].id).toBe("t-2");
  });
});

// ── C2. Engineer can access tasks ─────────────────────────────────────────
describe("C2: Engineer accesses task list (route does not restrict by role)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTask.findMany.mockResolvedValue([TASK_1]);
  });

  it("GET /api/tasks returns 200 for engineer (withAuth, not withManager)", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(200);
  });
});

// ── C3. Manager can create KPI ─────────────────────────────────────────────
describe("C3: Manager can create KPI via POST /api/kpi", () => {
  const NEW_KPI = {
    id: "kpi-new",
    year: 2024,
    code: "KPI-02",
    title: "Cost Reduction",
    target: 10,
    actual: 0,
    weight: 1,
    autoCalc: false,
    taskLinks: [],
    deliverables: [],
    creator: { id: "mgr-1", name: "Manager" },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockKPI.create.mockResolvedValue(NEW_KPI);
  });

  it("POST /api/kpi returns 201 for manager role", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(
      createMockRequest("/api/kpi", {
        method: "POST",
        body: { year: 2024, code: "KPI-02", title: "Cost Reduction", target: 10 },
      })
    );
    expect(res.status).toBe(201);
  });

  it("KPI is persisted with createdBy from manager session", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    await POST(
      createMockRequest("/api/kpi", {
        method: "POST",
        body: { year: 2024, code: "KPI-02", title: "Cost Reduction", target: 10 },
      })
    );
    expect(mockKPI.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ createdBy: "mgr-1" }),
      })
    );
  });
});

// ── C4. Engineer cannot create KPI ────────────────────────────────────────
describe("C4: Engineer is forbidden from creating KPI", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
  });

  it("POST /api/kpi returns 403 for engineer role", async () => {
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(
      createMockRequest("/api/kpi", {
        method: "POST",
        body: { year: 2024, code: "KPI-02", title: "Cost Reduction", target: 10 },
      })
    );
    expect(res.status).toBe(403);
  });

  it("POST /api/users returns 403 for engineer role (withManager gate)", async () => {
    const { POST } = await import("@/app/api/users/route");
    const res = await POST(
      createMockRequest("/api/users", {
        method: "POST",
        body: {
          name: "New User",
          email: "new@test.com",
          password: "password123",
        },
      })
    );
    expect(res.status).toBe(403);
  });
});

// ── C5. Unauthenticated requests ───────────────────────────────────────────
describe("C5: Unauthenticated requests are rejected across all endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
  });

  it("GET /api/tasks returns 401 without session", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("GET /api/users returns 401 without session", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(createMockRequest("/api/users"));
    expect(res.status).toBe(401);
  });

  it("GET /api/kpi returns 401 without session", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(401);
  });

  it("GET /api/time-entries returns 401 without session", async () => {
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(createMockRequest("/api/time-entries"));
    expect(res.status).toBe(401);
  });
});
