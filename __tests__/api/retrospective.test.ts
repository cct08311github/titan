/**
 * @jest-environment node
 */
/**
 * API route tests: /api/retrospective/generate — Issue #969
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findMany: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: {
    task: mockTask,
    timeEntry: mockTimeEntry,
  },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MANAGER" }, expires: "2099" };

describe("GET /api/retrospective/generate", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockTask.findMany.mockResolvedValue([
      {
        id: "t1",
        title: "Task 1",
        category: "PLANNED",
        priority: "P1",
        primaryAssignee: { id: "u1", name: "Test" },
        completedAt: new Date("2026-03-15"),
        updatedAt: new Date("2026-03-15"),
      },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      { userId: "u1", hours: 8, user: { id: "u1", name: "Test" } },
      { userId: "u1", hours: 7.5, user: { id: "u1", name: "Test" } },
    ]);
  });

  it("returns monthly summary", async () => {
    const { GET } = await import("@/app/api/retrospective/generate/route");
    const res = await (GET as Function)(
      createMockRequest("/api/retrospective/generate", {
        searchParams: { month: "2026-03" },
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.month).toBe("2026-03");
    expect(body.data.completedTaskCount).toBe(1);
    expect(body.data.totalHoursLogged).toBe(15.5);
    expect(body.data.topContributors).toHaveLength(1);
  });

  it("returns 400 for invalid month", async () => {
    const { GET } = await import("@/app/api/retrospective/generate/route");
    const res = await (GET as Function)(
      createMockRequest("/api/retrospective/generate", {
        searchParams: { month: "invalid" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 for missing month", async () => {
    const { GET } = await import("@/app/api/retrospective/generate/route");
    const res = await (GET as Function)(
      createMockRequest("/api/retrospective/generate")
    );
    expect(res.status).toBe(400);
  });

  it("returns 401 without session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/retrospective/generate/route");
    const res = await (GET as Function)(
      createMockRequest("/api/retrospective/generate", {
        searchParams: { month: "2026-03" },
      })
    );
    expect(res.status).toBe(401);
  });
});
