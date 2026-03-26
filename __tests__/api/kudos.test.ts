/**
 * @jest-environment node
 */
/**
 * API route tests: /api/kudos — Issue #969
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findUnique: jest.fn() };
const mockTaskActivity = { findMany: jest.fn(), create: jest.fn() };
const mockNotification = { create: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    taskActivity: mockTaskActivity,
    notification: mockNotification,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Sender", email: "s@e.com", role: "ENGINEER" }, expires: "2099" };

describe("POST /api/kudos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTask.findUnique.mockResolvedValue({
      id: "task-1",
      title: "Great Work",
      primaryAssigneeId: "u2",
    });
    mockTaskActivity.create.mockResolvedValue({
      id: "ka-1",
      taskId: "task-1",
      userId: "u1",
      action: "KUDOS",
      detail: { message: "", fromUser: "Sender" },
      user: { id: "u1", name: "Sender" },
      task: { id: "task-1", title: "Great Work" },
    });
    mockNotification.create.mockResolvedValue({});
  });

  it("creates kudos activity", async () => {
    const { POST } = await import("@/app/api/kudos/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kudos", {
        method: "POST",
        body: { taskId: "task-1" },
      })
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.data.action).toBe("KUDOS");
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { POST } = await import("@/app/api/kudos/route");
    const res = await (POST as Function)(
      createMockRequest("/api/kudos", {
        method: "POST",
        body: { taskId: "task-1" },
      })
    );
    expect(res.status).toBe(401);
  });
});

describe("GET /api/kudos", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTaskActivity.findMany.mockResolvedValue([
      {
        id: "ka-1",
        action: "KUDOS",
        user: { id: "u1", name: "Sender" },
        task: { id: "task-1", title: "Great Work" },
        createdAt: new Date(),
      },
    ]);
  });

  it("returns kudos list", async () => {
    const { GET } = await import("@/app/api/kudos/route");
    const res = await (GET as Function)(createMockRequest("/api/kudos"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.items).toHaveLength(1);
  });
});
