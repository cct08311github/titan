/**
 * @jest-environment node
 */
/**
 * API route tests: /api/deliverables and /api/deliverables/[id]
 */
import { createMockRequest } from "../utils/test-utils";

const mockDeliverable = { create: jest.fn(), update: jest.fn(), delete: jest.fn() };
const mockAuditLog = { create: jest.fn().mockResolvedValue({}) };

jest.mock("@/lib/prisma", () => ({ prisma: { deliverable: mockDeliverable, auditLog: mockAuditLog } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };
const MANAGER_SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_DEL = { id: "del-1", title: "Deliverable 1", type: "DOCUMENT", taskId: "task-1", status: "NOT_STARTED", kpiId: null, annualPlanId: null, monthlyGoalId: null, attachmentUrl: null };

describe("POST /api/deliverables", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockDeliverable.create.mockResolvedValue(MOCK_DEL);
  });

  it("creates deliverable with valid data", async () => {
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(createMockRequest("/api/deliverables", { method: "POST", body: { title: "Del", type: "DOCUMENT", taskId: "task-1" } }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.id).toBe("del-1");
  });

  it("returns 400 when title missing", async () => {
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(createMockRequest("/api/deliverables", { method: "POST", body: { type: "DOCUMENT" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when type missing", async () => {
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(createMockRequest("/api/deliverables", { method: "POST", body: { title: "Del" } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(createMockRequest("/api/deliverables", { method: "POST", body: { title: "Del", type: "DOCUMENT" } }));
    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockDeliverable.create.mockRejectedValue(new Error("DB"));
    const { POST } = await import("@/app/api/deliverables/route");
    const res = await POST(createMockRequest("/api/deliverables", { method: "POST", body: { title: "Del", type: "DOCUMENT" } }));
    expect(res.status).toBe(500);
  });
});

describe("PATCH/DELETE /api/deliverables/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockDeliverable.update.mockResolvedValue({ ...MOCK_DEL, status: "DONE" });
    mockDeliverable.delete.mockResolvedValue(MOCK_DEL);
  });

  it("PATCH updates deliverable status", async () => {
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/deliverables/del-1", { method: "PATCH", body: { status: "DONE" } }),
      { params: Promise.resolve({ id: "del-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("PATCH returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/deliverables/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/deliverables/del-1", { method: "PATCH", body: {} }),
      { params: Promise.resolve({ id: "del-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("DELETE removes deliverable", async () => {
    const { DELETE } = await import("@/app/api/deliverables/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/deliverables/del-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "del-1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.success).toBe(true);
  });

  it("DELETE returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/deliverables/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/deliverables/del-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "del-1" }) }
    );
    expect(res.status).toBe(401);
  });
});
