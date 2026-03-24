/**
 * @jest-environment node
 */
/**
 * API route tests: /api/subtasks and /api/subtasks/[id]
 */
import { createMockRequest } from "../utils/test-utils";

const mockSubTask = { create: jest.fn(), update: jest.fn(), delete: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { subTask: mockSubTask } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };

const MOCK_SUBTASK = { id: "sub-1", taskId: "task-1", title: "Sub Task", done: false, order: 0, assigneeId: null, dueDate: null };

describe("POST /api/subtasks", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockSubTask.create.mockResolvedValue(MOCK_SUBTASK);
  });

  it("creates subtask with valid data", async () => {
    const { POST } = await import("@/app/api/subtasks/route");
    const res = await POST(createMockRequest("/api/subtasks", { method: "POST", body: { taskId: "task-1", title: "Sub Task" } }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.id).toBe("sub-1");
  });

  it("returns 400 when taskId missing", async () => {
    const { POST } = await import("@/app/api/subtasks/route");
    const res = await POST(createMockRequest("/api/subtasks", { method: "POST", body: { title: "Sub" } }));
    expect(res.status).toBe(400);
  });

  it("returns 400 when title missing", async () => {
    const { POST } = await import("@/app/api/subtasks/route");
    const res = await POST(createMockRequest("/api/subtasks", { method: "POST", body: { taskId: "task-1" } }));
    expect(res.status).toBe(400);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/subtasks/route");
    const res = await POST(createMockRequest("/api/subtasks", { method: "POST", body: { taskId: "task-1", title: "Sub" } }));
    expect(res.status).toBe(401);
  });

  it("returns 500 on database error", async () => {
    mockSubTask.create.mockRejectedValue(new Error("DB"));
    const { POST } = await import("@/app/api/subtasks/route");
    const res = await POST(createMockRequest("/api/subtasks", { method: "POST", body: { taskId: "task-1", title: "Sub" } }));
    expect(res.status).toBe(500);
  });
});

describe("PATCH/DELETE /api/subtasks/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockSubTask.update.mockResolvedValue({ ...MOCK_SUBTASK, done: true });
    mockSubTask.delete.mockResolvedValue(MOCK_SUBTASK);
  });

  it("PATCH updates subtask done status", async () => {
    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", { method: "PATCH", body: { done: true } }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.done).toBe(true);
  });

  it("PATCH updates subtask title", async () => {
    mockSubTask.update.mockResolvedValue({ ...MOCK_SUBTASK, title: "Updated" });
    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", { method: "PATCH", body: { title: "Updated" } }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("PATCH returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", { method: "PATCH", body: { done: true } }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("DELETE removes subtask", async () => {
    const { DELETE } = await import("@/app/api/subtasks/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/subtasks/sub-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
  });

  it("DELETE returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { DELETE } = await import("@/app/api/subtasks/[id]/route");
    const res = await DELETE(
      createMockRequest("/api/subtasks/sub-1", { method: "DELETE" }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );
    expect(res.status).toBe(401);
  });
});
