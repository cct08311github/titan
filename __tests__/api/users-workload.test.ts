/**
 * @jest-environment node
 */
/**
 * API route tests: GET /api/users/[id]/workload
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findMany: jest.fn(), count: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockUser = { findUnique: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: { task: mockTask, timeEntry: mockTimeEntry, user: mockUser },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const SESSION = { user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" }, expires: "2099" };
const MANAGER_SESSION = { user: { id: "mgr1", name: "Mgr", email: "m@e.com", role: "MANAGER" }, expires: "2099" };

const MOCK_USER = { id: "u1", name: "Test User", email: "t@e.com", role: "MEMBER", isActive: true };

describe("GET /api/users/[id]/workload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockUser.findUnique.mockResolvedValue(MOCK_USER);
    mockTask.findMany.mockResolvedValue([
      { id: "t1", status: "TODO", estimatedHours: 4 },
      { id: "t2", status: "IN_PROGRESS", estimatedHours: 8 },
      { id: "t3", status: "DONE", estimatedHours: 3 },
    ]);
    mockTask.count.mockResolvedValue(3);
    mockTimeEntry.findMany.mockResolvedValue([
      { hours: 2 },
      { hours: 3 },
    ]);
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(401);
  });

  it("returns 404 when user not found (manager context)", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    mockUser.findUnique.mockResolvedValue(null);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/nonexistent/workload"),
      { params: Promise.resolve({ id: "nonexistent" }) }
    );
    expect(res.status).toBe(404);
  });

  it("returns workload data with taskCount, totalHours, and loadPct", async () => {
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    const data = body.data;
    expect(data).toHaveProperty("taskCount");
    expect(data).toHaveProperty("totalHours");
    expect(data).toHaveProperty("loadPct");
    expect(data).toHaveProperty("userId");
  });

  it("calculates taskCount from active tasks only (excluding DONE)", async () => {
    mockTask.findMany.mockResolvedValue([
      { id: "t1", status: "TODO", estimatedHours: 4 },
      { id: "t2", status: "IN_PROGRESS", estimatedHours: 8 },
    ]);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    const body = await res.json();
    const data = body.data;
    expect(data.taskCount).toBe(2);
  });

  it("returns totalHours summed from time entries", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { hours: 5 },
      { hours: 7 },
    ]);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    const body = await res.json();
    const data = body.data;
    expect(data.totalHours).toBe(12);
  });

  it("allows manager to view any user's workload", async () => {
    mockGetServerSession.mockResolvedValue(MANAGER_SESSION);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("allows user to view own workload", async () => {
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(200);
  });

  it("returns 403 when member tries to view another user's workload", async () => {
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/other-user/workload"),
      { params: Promise.resolve({ id: "other-user" }) }
    );
    expect(res.status).toBe(403);
  });

  it("accepts startDate and endDate params for time entry range", async () => {
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload", {
        searchParams: { startDate: "2024-01-01", endDate: "2024-01-31" },
      }),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(200);
    expect(mockTimeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          date: expect.objectContaining({ gte: expect.any(Date), lte: expect.any(Date) }),
        }),
      })
    );
  });

  it("returns 500 on database error", async () => {
    mockTask.findMany.mockRejectedValue(new Error("DB error"));
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    expect(res.status).toBe(500);
  });
});
