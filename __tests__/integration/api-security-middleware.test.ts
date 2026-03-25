/**
 * @jest-environment node
 */
/**
 * Layer 1.5 Integration Tests — Section A: API Route + Security Middleware
 *
 * Tests the combination of route handler + withAuth/withManager middleware
 * to verify authentication gates, role enforcement, and response shape.
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockTask = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  count: jest.fn().mockResolvedValue(0),
};
const mockUser = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockKPI = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockTimeEntry = {
  findMany: jest.fn(),
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};
const mockTaskActivity = { create: jest.fn() };
const mockTaskChange = { create: jest.fn() };
const mockAuditLog = { create: jest.fn() };
const mockPermission = { findFirst: jest.fn() };
const mockTransaction = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    user: mockUser,
    kPI: mockKPI,
    timeEntry: mockTimeEntry,
    taskActivity: mockTaskActivity,
    taskChange: mockTaskChange,
    auditLog: mockAuditLog,
    permission: mockPermission,
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

// ── Data fixtures ──────────────────────────────────────────────────────────
const MOCK_TASK = {
  id: "task-1",
  title: "Integration Test Task",
  status: "TODO",
  priority: "P2",
  category: "PLANNED",
  primaryAssignee: null,
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

const MOCK_USER = {
  id: "user-1",
  name: "Test User",
  email: "test@example.com",
  role: "ENGINEER",
  avatar: null,
  isActive: true,
  createdAt: new Date("2024-01-01"),
};

const MOCK_KPI = {
  id: "kpi-1",
  year: 2024,
  code: "KPI-01",
  title: "System Uptime",
  target: 99.9,
  actual: 99.5,
  weight: 1,
  autoCalc: false,
  taskLinks: [],
  deliverables: [],
  creator: { id: "mgr-1", name: "Manager" },
};

const MOCK_TIME_ENTRY = {
  id: "entry-1",
  userId: "eng-1",
  taskId: null,
  date: new Date("2024-01-15"),
  hours: 6,
  category: "PLANNED_TASK",
  description: null,
  task: null,
};

// ── A1. GET /api/tasks ─────────────────────────────────────────────────────
describe("A1: GET /api/tasks — withAuth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTask.findMany.mockResolvedValue([MOCK_TASK]);
  });

  it("authenticated engineer receives task list with status 200", async () => {
    mockTask.count.mockResolvedValue(1);
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
    expect(body.data.items[0].id).toBe("task-1");
  });

  it("unauthenticated request blocked with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tasks/route");
    const res = await GET(createMockRequest("/api/tasks"));
    expect(res.status).toBe(401);
  });

  it("status filter propagated to prisma query", async () => {
    const { GET } = await import("@/app/api/tasks/route");
    await GET(createMockRequest("/api/tasks", { searchParams: { status: "IN_PROGRESS" } }));
    expect(mockTask.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "IN_PROGRESS" }) })
    );
  });
});

// ── A2. POST /api/tasks ────────────────────────────────────────────────────
describe("A2: POST /api/tasks — withAuth + session creatorId injection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTask.create.mockResolvedValue(MOCK_TASK);
  });

  it("creates task and returns 201 for authenticated user", async () => {
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(
      createMockRequest("/api/tasks", { method: "POST", body: { title: "New Task" } })
    );
    expect(res.status).toBe(201);
  });

  it("task creation uses session userId as creatorId", async () => {
    const { POST } = await import("@/app/api/tasks/route");
    await POST(
      createMockRequest("/api/tasks", { method: "POST", body: { title: "Owned Task" } })
    );
    expect(mockTask.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ creatorId: "eng-1" }),
      })
    );
  });

  it("missing title returns 400 validation error", async () => {
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(
      createMockRequest("/api/tasks", { method: "POST", body: {} })
    );
    expect(res.status).toBe(400);
  });

  it("unauthenticated POST returns 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/tasks/route");
    const res = await POST(
      createMockRequest("/api/tasks", { method: "POST", body: { title: "T" } })
    );
    expect(res.status).toBe(401);
  });
});

// ── A3. GET /api/users ─────────────────────────────────────────────────────
describe("A3: GET /api/users — withAuth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockUser.findMany.mockResolvedValue([MOCK_USER]);
  });

  it("authenticated user receives user list", async () => {
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(createMockRequest("/api/users"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].id).toBe("user-1");
  });

  it("unauthenticated user receives 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/users/route");
    const res = await GET(createMockRequest("/api/users"));
    expect(res.status).toBe(401);
  });
});

// ── A4. GET /api/kpi ───────────────────────────────────────────────────────
describe("A4: GET /api/kpi — withAuth middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockKPI.findMany.mockResolvedValue([MOCK_KPI]);
  });

  it("authenticated user gets KPI list with status 200", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].code).toBe("KPI-01");
  });

  it("year query param is parsed as integer and passed to prisma", async () => {
    const { GET } = await import("@/app/api/kpi/route");
    await GET(createMockRequest("/api/kpi", { searchParams: { year: "2023" } }));
    expect(mockKPI.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { year: 2023 } })
    );
  });

  it("unauthenticated request blocked with 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/kpi/route");
    const res = await GET(createMockRequest("/api/kpi"));
    expect(res.status).toBe(401);
  });
});

// ── A5. POST /api/kpi — withManager enforces MANAGER role ─────────────────
describe("A5: POST /api/kpi — withManager role gate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockKPI.create.mockResolvedValue(MOCK_KPI);
  });

  it("manager can create KPI (201)", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(
      createMockRequest("/api/kpi", {
        method: "POST",
        body: { year: 2024, code: "KPI-01", title: "Uptime", target: 99.9 },
      })
    );
    expect(res.status).toBe(201);
  });

  it("engineer is forbidden from creating KPI (403)", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(
      createMockRequest("/api/kpi", {
        method: "POST",
        body: { year: 2024, code: "KPI-01", title: "Uptime", target: 99.9 },
      })
    );
    expect(res.status).toBe(403);
  });

  it("unauthenticated POST returns 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/kpi/route");
    const res = await POST(
      createMockRequest("/api/kpi", {
        method: "POST",
        body: { year: 2024, code: "KPI-01", title: "Uptime", target: 99.9 },
      })
    );
    expect(res.status).toBe(401);
  });
});

// ── A6. GET /api/time-entries — IDOR protection ────────────────────────────
describe("A6: GET /api/time-entries — IDOR protection middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockTimeEntry.findMany.mockResolvedValue([MOCK_TIME_ENTRY]);
  });

  it("engineer can read own time entries (200)", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(createMockRequest("/api/time-entries"));
    expect(res.status).toBe(200);
  });

  it("engineer blocked from reading another user's time entries (403)", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(
      createMockRequest("/api/time-entries", {
        searchParams: { userId: "other-user-id" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("manager can read any user's time entries (200)", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(
      createMockRequest("/api/time-entries", {
        searchParams: { userId: "eng-1" },
      })
    );
    expect(res.status).toBe(200);
  });

  it("unauthenticated request returns 401", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/time-entries/route");
    const res = await GET(createMockRequest("/api/time-entries"));
    expect(res.status).toBe(401);
  });
});

// ── A7. POST /api/time-entries — session userId ownership ─────────────────
describe("A7: POST /api/time-entries — session userId as owner", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTimeEntry.create.mockResolvedValue(MOCK_TIME_ENTRY);
  });

  it("creates time entry and always sets userId from session (not body)", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    await POST(
      createMockRequest("/api/time-entries", {
        method: "POST",
        body: { date: "2024-01-15", hours: 6, userId: "attacker-id" },
      })
    );
    expect(mockTimeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ userId: "eng-1" }),
      })
    );
  });

  it("missing date returns 400", async () => {
    const { POST } = await import("@/app/api/time-entries/route");
    const res = await POST(
      createMockRequest("/api/time-entries", { method: "POST", body: { hours: 6 } })
    );
    expect(res.status).toBe(400);
  });
});
