/**
 * @jest-environment node
 */
/**
 * API tests: Bulk Operations — Issue #506
 *
 * Covers:
 *  - PATCH /api/tasks/bulk — successful bulk update
 *  - Validation: empty taskIds, missing updates
 *  - ENGINEER ownership check
 *  - MANAGER can update any tasks
 */
import { createMockRequest } from "../utils/test-utils";

// ── Mock Prisma ────────────────────────────────────────────────────────────
const mockTaskFindMany = jest.fn();
const mockTaskUpdateMany = jest.fn();

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: {
      findMany: (...args: unknown[]) => mockTaskFindMany(...args),
      updateMany: (...args: unknown[]) => mockTaskUpdateMany(...args),
    },
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...args: unknown[]) => mockGetServerSession(...args),
}));

// Session fixtures
const ENGINEER_SESSION = {
  user: { id: "eng-1", name: "Engineer", email: "eng@test.com", role: "ENGINEER" },
  expires: "2099-01-01",
};

const MANAGER_SESSION = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@test.com", role: "MANAGER" },
  expires: "2099-01-01",
};

describe("PATCH /api/tasks/bulk", () => {
  let PATCH: (req: Request) => Promise<Response>;

  beforeAll(async () => {
    const mod = await import("@/app/api/tasks/bulk/route");
    PATCH = mod.PATCH as unknown as (req: Request) => Promise<Response>;
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const req = createMockRequest("/api/tasks/bulk", {
      method: "PATCH",
      body: { taskIds: ["t1"], updates: { status: "DONE" } },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  // TODO: #775 — prisma.$transaction mock missing after dependency update
  it.skip("manager can bulk update any tasks", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockTaskUpdateMany.mockResolvedValue({ count: 2 });
    const req = createMockRequest("/api/tasks/bulk", {
      method: "PATCH",
      body: { taskIds: ["t1", "t2"], updates: { status: "DONE" } },
    });
    const res = await PATCH(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.data.updated).toBe(2);
  });

  // TODO: #775 — prisma.$transaction mock missing after dependency update
  it.skip("engineer can update own tasks", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTaskFindMany.mockResolvedValue([
      { id: "t1", primaryAssigneeId: "eng-1", backupAssigneeId: null },
    ]);
    mockTaskUpdateMany.mockResolvedValue({ count: 1 });
    const req = createMockRequest("/api/tasks/bulk", {
      method: "PATCH",
      body: { taskIds: ["t1"], updates: { priority: "P0" } },
    });
    const res = await PATCH(req);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.ok).toBe(true);
  });

  it("engineer cannot update unassigned tasks", async () => {
    mockGetServerSession.mockResolvedValue(ENGINEER_SESSION);
    mockTaskFindMany.mockResolvedValue([
      { id: "t1", primaryAssigneeId: "other-user", backupAssigneeId: null },
    ]);
    const req = createMockRequest("/api/tasks/bulk", {
      method: "PATCH",
      body: { taskIds: ["t1"], updates: { status: "DONE" } },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(403);
  });

  it("rejects empty taskIds array", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const req = createMockRequest("/api/tasks/bulk", {
      method: "PATCH",
      body: { taskIds: [], updates: { status: "DONE" } },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("rejects when no update fields provided", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const req = createMockRequest("/api/tasks/bulk", {
      method: "PATCH",
      body: { taskIds: ["t1"], updates: {} },
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });
});
