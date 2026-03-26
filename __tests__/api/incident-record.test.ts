/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #855: IncidentRecord API
 */
import { createMockRequest } from "../utils/test-utils";

const mockIncidentRecord = {
  findUnique: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
};
const mockTask = {
  findUnique: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    incidentRecord: mockIncidentRecord,
    task: mockTask,
    auditLog: { create: jest.fn() },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" },
  expires: "2099",
};

const MOCK_INCIDENT = {
  id: "inc-1",
  taskId: "task-1",
  severity: "SEV1",
  impactScope: "核心交易系統中斷",
  incidentStart: new Date("2026-03-26T10:00:00Z"),
  incidentEnd: new Date("2026-03-26T12:30:00Z"),
  rootCause: "undo tablespace 不足",
  resolution: "擴充 undo tablespace",
  mttrMinutes: 150,
  reportedBy: "志偉",
  createdAt: new Date(),
  updatedAt: new Date(),
};

describe("POST /api/tasks/[id]/incident", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("creates incident record for INCIDENT task", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-1", category: "INCIDENT" });
    mockIncidentRecord.findUnique.mockResolvedValue(null);
    mockIncidentRecord.create.mockResolvedValue(MOCK_INCIDENT);

    const { POST } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/incident", {
        method: "POST",
        body: {
          severity: "SEV1",
          impactScope: "核心交易系統中斷",
          incidentStart: "2026-03-26T10:00:00.000Z",
          incidentEnd: "2026-03-26T12:30:00.000Z",
          rootCause: "undo tablespace 不足",
          resolution: "擴充 undo tablespace",
          reportedBy: "志偉",
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.severity).toBe("SEV1");
    expect(body.data.mttrMinutes).toBe(150);
  });

  it("returns 400 when task is not INCIDENT category", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-2", category: "PLANNED" });

    const { POST } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-2/incident", {
        method: "POST",
        body: {
          severity: "SEV1",
          impactScope: "test",
          incidentStart: "2026-03-26T10:00:00.000Z",
        },
      }),
      { params: Promise.resolve({ id: "task-2" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 404 when task does not exist", async () => {
    mockTask.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await POST(
      createMockRequest("/api/tasks/nonexist/incident", {
        method: "POST",
        body: {
          severity: "SEV1",
          impactScope: "test",
          incidentStart: "2026-03-26T10:00:00.000Z",
        },
      }),
      { params: Promise.resolve({ id: "nonexist" }) }
    );

    expect(res.status).toBe(404);
  });

  it("returns 400 when missing required fields", async () => {
    mockTask.findUnique.mockResolvedValue({ id: "task-1", category: "INCIDENT" });
    mockIncidentRecord.findUnique.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/incident", {
        method: "POST",
        body: {
          severity: "SEV1",
          // missing impactScope and incidentStart
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { POST } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await POST(
      createMockRequest("/api/tasks/task-1/incident", {
        method: "POST",
        body: {
          severity: "SEV1",
          impactScope: "test",
          incidentStart: "2026-03-26T10:00:00.000Z",
        },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(401);
  });
});

describe("GET /api/tasks/[id]/incident", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("returns incident record when exists", async () => {
    mockIncidentRecord.findUnique.mockResolvedValue(MOCK_INCIDENT);

    const { GET } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await GET(
      createMockRequest("/api/tasks/task-1/incident"),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.severity).toBe("SEV1");
  });

  it("returns null when no incident record", async () => {
    mockIncidentRecord.findUnique.mockResolvedValue(null);

    const { GET } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await GET(
      createMockRequest("/api/tasks/task-1/incident"),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toBeNull();
  });
});

describe("PATCH /api/tasks/[id]/incident", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("updates existing incident record", async () => {
    mockIncidentRecord.findUnique.mockResolvedValue(MOCK_INCIDENT);
    mockIncidentRecord.update.mockResolvedValue({
      ...MOCK_INCIDENT,
      severity: "SEV2",
    });

    const { PATCH } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/incident", {
        method: "PATCH",
        body: { severity: "SEV2" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.severity).toBe("SEV2");
  });

  it("returns 404 when no record exists", async () => {
    mockIncidentRecord.findUnique.mockResolvedValue(null);

    const { PATCH } = await import("@/app/api/tasks/[id]/incident/route");
    const res = await PATCH(
      createMockRequest("/api/tasks/task-1/incident", {
        method: "PATCH",
        body: { severity: "SEV2" },
      }),
      { params: Promise.resolve({ id: "task-1" }) }
    );

    expect(res.status).toBe(404);
  });
});

describe("Incident validators", () => {
  it("rejects incidentEnd before incidentStart", () => {
    const { createIncidentRecordSchema } = require("@/validators/incident-validators");
    const result = createIncidentRecordSchema.safeParse({
      severity: "SEV1",
      impactScope: "test",
      incidentStart: "2026-03-26T12:00:00.000Z",
      incidentEnd: "2026-03-26T10:00:00.000Z", // before start
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid data with null incidentEnd", () => {
    const { createIncidentRecordSchema } = require("@/validators/incident-validators");
    const result = createIncidentRecordSchema.safeParse({
      severity: "SEV1",
      impactScope: "核心系統中斷",
      incidentStart: "2026-03-26T10:00:00.000Z",
      incidentEnd: null,
    });
    expect(result.success).toBe(true);
  });

  it("MTTR is null when incidentEnd is null", () => {
    function calcMttr(start: Date, end: Date | null): number | null {
      if (!end) return null;
      return Math.round((end.getTime() - start.getTime()) / 60000);
    }
    const result = calcMttr(new Date("2026-03-26T10:00:00Z"), null);
    expect(result).toBeNull();
  });

  it("MTTR calculates correctly in minutes", () => {
    function calcMttr(start: Date, end: Date | null): number | null {
      if (!end) return null;
      return Math.round((end.getTime() - start.getTime()) / 60000);
    }
    const result = calcMttr(
      new Date("2026-03-26T10:00:00Z"),
      new Date("2026-03-26T12:30:00Z")
    );
    expect(result).toBe(150); // 2.5 hours = 150 minutes
  });
});
