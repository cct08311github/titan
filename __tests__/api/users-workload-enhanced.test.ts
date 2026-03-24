/**
 * @jest-environment node
 */
import { createMockRequest } from "../utils/test-utils";

const mockTask = { findMany: jest.fn(), count: jest.fn() };
const mockTimeEntry = { findMany: jest.fn() };
const mockUser = { findUnique: jest.fn() };

jest.mock("@/lib/prisma", () => ({
  prisma: { task: mockTask, timeEntry: mockTimeEntry, user: mockUser },
}));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION = {
  user: { id: "u1", name: "Test", email: "t@e.com", role: "MEMBER" },
  expires: "2099",
};
const MOCK_USER = {
  id: "u1", name: "Test User", email: "t@e.com", role: "MEMBER", isActive: true,
};

describe("GET /api/users/[id]/workload - enhanced fields", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(SESSION);
    mockUser.findUnique.mockResolvedValue(MOCK_USER);
    mockTask.findMany.mockResolvedValue([
      { id: "t1", status: "TODO", estimatedHours: 4 },
    ]);
  });

  it("returns unplannedRatio based on time entry categories", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { hours: 6, category: "PLANNED_TASK", date: new Date() },
      { hours: 2, category: "ADDED_TASK", date: new Date() },
      { hours: 2, category: "INCIDENT", date: new Date() },
    ]);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    const body = await res.json();
    expect(body.data.plannedHours).toBe(6);
    expect(body.data.unplannedHours).toBe(4);
    expect(body.data.unplannedRatio).toBe(0.4);
    expect(body.data).toHaveProperty("weeklyHours");
  });

  it("returns unplannedRatio as 0 when no time entries", async () => {
    mockTimeEntry.findMany.mockResolvedValue([]);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    const body = await res.json();
    expect(body.data.unplannedRatio).toBe(0);
    expect(body.data.weeklyHours).toBe(0);
  });

  it("calculates SUPPORT category as unplanned", async () => {
    mockTimeEntry.findMany.mockResolvedValue([
      { hours: 4, category: "PLANNED_TASK", date: new Date() },
      { hours: 6, category: "SUPPORT", date: new Date() },
    ]);
    const { GET } = await import("@/app/api/users/[id]/workload/route");
    const res = await GET(
      createMockRequest("/api/users/u1/workload"),
      { params: Promise.resolve({ id: "u1" }) }
    );
    const body = await res.json();
    expect(body.data.unplannedHours).toBe(6);
    expect(body.data.unplannedRatio).toBe(0.6);
  });
});
