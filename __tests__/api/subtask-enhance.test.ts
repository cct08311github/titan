/**
 * @jest-environment node
 */
/**
 * TDD tests for Issue #856: SubTask enhancement (notes, result, completedAt)
 */
import { createMockRequest } from "../utils/test-utils";

const mockSubTask = {
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  findMany: jest.fn().mockResolvedValue([]),
  findUnique: jest.fn(),
};
const mockTask = { update: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: { subTask: mockSubTask, task: mockTask },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099",
};

describe("PATCH /api/subtasks/[id] — enhanced fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
  });

  it("accepts notes field", async () => {
    mockSubTask.update.mockResolvedValue({
      id: "sub-1",
      taskId: "task-1",
      title: "TC-001",
      done: false,
      order: 0,
      notes: "ulimit 設定需調整",
      result: null,
      completedAt: null,
    });

    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", {
        method: "PATCH",
        body: { notes: "ulimit 設定需調整" },
      }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.notes).toBe("ulimit 設定需調整");
  });

  it("accepts result field", async () => {
    mockSubTask.update.mockResolvedValue({
      id: "sub-1",
      taskId: "task-1",
      title: "TC-001",
      done: false,
      order: 0,
      notes: null,
      result: "FAIL",
      completedAt: null,
    });

    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", {
        method: "PATCH",
        body: { result: "FAIL" },
      }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.result).toBe("FAIL");
  });

  it("auto-sets completedAt when done becomes true", async () => {
    const now = new Date();
    mockSubTask.update.mockImplementation((args: { data: Record<string, unknown> }) => {
      return Promise.resolve({
        id: "sub-1",
        taskId: "task-1",
        title: "TC-001",
        done: true,
        order: 0,
        notes: null,
        result: null,
        completedAt: args.data.completedAt || now,
      });
    });

    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", {
        method: "PATCH",
        body: { done: true },
      }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );

    expect(res.status).toBe(200);
    // Verify update was called with completedAt
    expect(mockSubTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          done: true,
          completedAt: expect.any(Date),
        }),
      })
    );
  });

  it("clears completedAt when done becomes false", async () => {
    mockSubTask.update.mockResolvedValue({
      id: "sub-1",
      taskId: "task-1",
      title: "TC-001",
      done: false,
      order: 0,
      notes: null,
      result: null,
      completedAt: null,
    });

    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", {
        method: "PATCH",
        body: { done: false },
      }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );

    expect(res.status).toBe(200);
    expect(mockSubTask.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          done: false,
          completedAt: null,
        }),
      })
    );
  });

  it("rejects notes exceeding 10000 characters", async () => {
    const { PATCH } = await import("@/app/api/subtasks/[id]/route");
    const longNotes = "a".repeat(10001);
    const res = await PATCH(
      createMockRequest("/api/subtasks/sub-1", {
        method: "PATCH",
        body: { notes: longNotes },
      }),
      { params: Promise.resolve({ id: "sub-1" }) }
    );

    expect(res.status).toBe(400);
  });
});

describe("SubTask validator enhancements", () => {
  it("updateSubTaskSchema accepts notes and result", () => {
    const { updateSubTaskSchema } = require("@/validators/subtask-validators");
    const result = updateSubTaskSchema.safeParse({
      notes: "Test notes",
      result: "PASS",
    });
    expect(result.success).toBe(true);
  });

  it("updateSubTaskSchema accepts null notes", () => {
    const { updateSubTaskSchema } = require("@/validators/subtask-validators");
    const result = updateSubTaskSchema.safeParse({
      notes: null,
    });
    expect(result.success).toBe(true);
  });
});
