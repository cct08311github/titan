/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #858: ChangeRecord API + state machine
 */
import { createMockRequest } from "../utils/test-utils";

const mockChangeRecord = {
  findUnique: jest.fn(),
  findFirst: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockTask = {
  findUnique: jest.fn(),
};
const mockNotification = {
  createMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    changeRecord: mockChangeRecord,
    task: mockTask,
    notification: mockNotification,
    auditLog: { create: jest.fn() },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION_MANAGER = {
  user: { id: "u1", name: "Manager", email: "m@e.com", role: "MANAGER" },
  expires: "2099",
};

const SESSION_ENGINEER = {
  user: { id: "u2", name: "Engineer", email: "e@e.com", role: "ENGINEER" },
  expires: "2099",
};

const MOCK_CHANGE = {
  id: "chg-1",
  taskId: "task-1",
  changeNumber: "CHG-2026-0326-01",
  type: "NORMAL",
  riskLevel: "HIGH",
  impactedSystems: ["核心交易系統", "帳務系統"],
  scheduledStart: new Date("2026-03-28T14:00:00Z"),
  scheduledEnd: new Date("2026-03-28T16:00:00Z"),
  actualStart: null,
  actualEnd: null,
  rollbackPlan: "回滾 Oracle patch",
  verificationPlan: "驗證交易查詢功能",
  status: "DRAFT",
  cabApprovedBy: null,
  cabApprovedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// ─── POST /api/tasks/[id]/change ───────────────────────────────────────

describe("POST /api/tasks/[id]/change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
  });

  it("creates change record with auto-generated changeNumber", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-1" });
    mockChangeRecord.findUnique.mockResolvedValue(null);
    mockChangeRecord.findFirst.mockResolvedValue(null); // no existing today
    mockChangeRecord.create.mockResolvedValue(MOCK_CHANGE);

    const { POST } = await import("@/app/api/tasks/[id]/change/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/change", {
        method: "POST",
        body: {
          type: "NORMAL",
          riskLevel: "HIGH",
          impactedSystems: ["核心交易系統", "帳務系統"],
          scheduledStart: "2026-03-28T14:00:00.000Z",
          scheduledEnd: "2026-03-28T16:00:00.000Z",
          rollbackPlan: "回滾 Oracle patch",
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.changeNumber).toBe("CHG-2026-0326-01");
    expect(body.data.type).toBe("NORMAL");
  });

  it("returns 404 when task does not exist", async () => {
    mockTask.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/change/route");
    const res = await POST(
      createMockRequest("/api/tasks/no-task/change", {
        method: "POST",
        body: {
          type: "NORMAL",
          riskLevel: "HIGH",
          impactedSystems: ["系統A"],
        },
      }),
      { params: Promise.resolve({ id: "no-task" }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when already exists", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-1" });
    mockChangeRecord.findUnique.mockResolvedValue(MOCK_CHANGE);

    const { POST } = await import("@/app/api/tasks/[id]/change/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/change", {
        method: "POST",
        body: {
          type: "NORMAL",
          riskLevel: "HIGH",
          impactedSystems: ["系統A"],
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 400 when impactedSystems is empty", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-1" });
    mockChangeRecord.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/change/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/change", {
        method: "POST",
        body: {
          type: "NORMAL",
          riskLevel: "HIGH",
          impactedSystems: [],
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/change/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/change", {
        method: "POST",
        body: {
          type: "NORMAL",
          riskLevel: "HIGH",
          impactedSystems: ["系統A"],
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/tasks/[id]/change ────────────────────────────────────────

describe("GET /api/tasks/[id]/change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
  });

  it("returns change record when exists", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(MOCK_CHANGE);

    const { GET } = await import("@/app/api/tasks/[id]/change/route");
    const res = await GET(
      createMockRequest("/api/tasks/task-1/change"),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.changeNumber).toBe("CHG-2026-0326-01");
  });

  it("returns null when no record", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/tasks/[id]/change/route");
    const res = await GET(
      createMockRequest("/api/tasks/task-1/change"),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
  });
});

// ─── PATCH /api/tasks/[id]/change ──────────────────────────────────────

describe("PATCH /api/tasks/[id]/change", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
  });

  it("updates existing change record", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(MOCK_CHANGE);
    mockChangeRecord.update.mockResolvedValue({ ...MOCK_CHANGE, riskLevel: "CRITICAL" });

    const { PATCH } = await import("@/app/api/tasks/[id]/change/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change", {
        method: "PATCH",
        body: { riskLevel: "CRITICAL" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.riskLevel).toBe("CRITICAL");
  });

  it("returns 404 when no record exists", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/tasks/[id]/change/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change", {
        method: "PATCH",
        body: { riskLevel: "CRITICAL" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /api/tasks/[id]/change/status ───────────────────────────────

describe("PATCH /api/tasks/[id]/change/status", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
  });

  it("valid transition: DRAFT -> PENDING_APPROVAL", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(MOCK_CHANGE);
    mockChangeRecord.update.mockResolvedValue({ ...MOCK_CHANGE, status: "PENDING_APPROVAL" });

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "PENDING_APPROVAL" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("PENDING_APPROVAL");
  });

  it("invalid transition: DRAFT -> COMPLETED returns 422", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(MOCK_CHANGE);

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "COMPLETED" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.message).toContain("PENDING_APPROVAL");
  });

  it("EMERGENCY can skip PENDING_APPROVAL: DRAFT -> APPROVED", async () => {
    const emergencyChange = { ...MOCK_CHANGE, type: "EMERGENCY" };
    mockChangeRecord.findUnique.mockResolvedValue(emergencyChange);
    mockChangeRecord.update.mockResolvedValue({ ...emergencyChange, status: "APPROVED" });

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("APPROVED");
  });

  it("NORMAL cannot skip: DRAFT -> APPROVED returns 422", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(MOCK_CHANGE); // type: NORMAL

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(422);
  });

  it("PENDING_APPROVAL -> APPROVED requires MANAGER role", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);
    const pendingChange = { ...MOCK_CHANGE, status: "PENDING_APPROVAL" };
    mockChangeRecord.findUnique.mockResolvedValue(pendingChange);

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(403);
  });

  it("VERIFYING -> IN_PROGRESS (退回重做) is valid", async () => {
    const verifyingChange = { ...MOCK_CHANGE, status: "VERIFYING" };
    mockChangeRecord.findUnique.mockResolvedValue(verifyingChange);
    mockChangeRecord.update.mockResolvedValue({ ...verifyingChange, status: "IN_PROGRESS" });

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "IN_PROGRESS" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
  });

  it("COMPLETED is terminal — no transitions allowed", async () => {
    const completedChange = { ...MOCK_CHANGE, status: "COMPLETED" };
    mockChangeRecord.findUnique.mockResolvedValue(completedChange);

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "DRAFT" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(422);
  });

  it("returns 404 when no change record", async () => {
    mockChangeRecord.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/tasks/[id]/change/status/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/change/status", {
        method: "PATCH",
        body: { status: "APPROVED" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(404);
  });
});

// ─── Validators ────────────────────────────────────────────────────────

describe("Change record validators", () => {
  it("rejects scheduledEnd before scheduledStart", () => {
    const { createChangeRecordSchema } = require("@/validators/change-record-validators");
    const result = createChangeRecordSchema.safeParse({
      type: "NORMAL",
      riskLevel: "HIGH",
      impactedSystems: ["系統A"],
      scheduledStart: "2026-03-28T16:00:00.000Z",
      scheduledEnd: "2026-03-28T14:00:00.000Z",
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid data", () => {
    const { createChangeRecordSchema } = require("@/validators/change-record-validators");
    const result = createChangeRecordSchema.safeParse({
      type: "NORMAL",
      riskLevel: "HIGH",
      impactedSystems: ["核心系統", "帳務系統"],
      scheduledStart: "2026-03-28T14:00:00.000Z",
      scheduledEnd: "2026-03-28T16:00:00.000Z",
      rollbackPlan: "回滾方案",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty impactedSystems", () => {
    const { createChangeRecordSchema } = require("@/validators/change-record-validators");
    const result = createChangeRecordSchema.safeParse({
      type: "NORMAL",
      riskLevel: "HIGH",
      impactedSystems: [],
    });
    expect(result.success).toBe(false);
  });
});

// ─── State machine unit tests ──────────────────────────────────────────

describe("Change state machine", () => {
  const { isValidTransition, getAllowedTransitions } = require("@/lib/change-state-machine");

  it("DRAFT -> PENDING_APPROVAL is valid for NORMAL", () => {
    expect(isValidTransition("DRAFT", "PENDING_APPROVAL", "NORMAL")).toBe(true);
  });

  it("DRAFT -> APPROVED is invalid for NORMAL", () => {
    expect(isValidTransition("DRAFT", "APPROVED", "NORMAL")).toBe(false);
  });

  it("DRAFT -> APPROVED is valid for EMERGENCY", () => {
    expect(isValidTransition("DRAFT", "APPROVED", "EMERGENCY")).toBe(true);
  });

  it("COMPLETED has no transitions", () => {
    expect(getAllowedTransitions("COMPLETED", "NORMAL")).toEqual([]);
  });

  it("ROLLED_BACK has no transitions", () => {
    expect(getAllowedTransitions("ROLLED_BACK", "NORMAL")).toEqual([]);
  });

  it("IN_PROGRESS -> VERIFYING or ROLLED_BACK", () => {
    const allowed = getAllowedTransitions("IN_PROGRESS", "NORMAL");
    expect(allowed).toContain("VERIFYING");
    expect(allowed).toContain("ROLLED_BACK");
    expect(allowed).not.toContain("COMPLETED");
  });

  it("VERIFYING -> COMPLETED or IN_PROGRESS", () => {
    const allowed = getAllowedTransitions("VERIFYING", "NORMAL");
    expect(allowed).toContain("COMPLETED");
    expect(allowed).toContain("IN_PROGRESS");
  });
});

// ─── Change number generator ──────────────────────────────────────────

describe("generateChangeNumber", () => {
  it("generates CHG-YYYY-MMDD-01 when no existing records", async () => {
    const { generateChangeNumber } = require("@/lib/change-number");
    const mockPrisma = {
      changeRecord: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
    };

    const result = await generateChangeNumber(mockPrisma);
    // Format: CHG-YYYY-MMDD-01 (today's date)
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    expect(result).toBe(`CHG-${now.getFullYear()}-${mm}${dd}-01`);
  });

  it("increments sequence when existing record found", async () => {
    const { generateChangeNumber } = require("@/lib/change-number");
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    const dd = String(now.getDate()).padStart(2, "0");
    const prefix = `CHG-${now.getFullYear()}-${mm}${dd}`;

    const mockPrisma = {
      changeRecord: {
        findFirst: jest.fn().mockResolvedValue({
          changeNumber: `${prefix}-03`,
        }),
      },
    };

    const result = await generateChangeNumber(mockPrisma);
    expect(result).toBe(`${prefix}-04`);
  });
});
