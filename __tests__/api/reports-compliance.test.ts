/**
 * @jest-environment node
 */
/**
 * TDD tests for GET /api/reports/timesheet-compliance (TS-28)
 *
 * Requirements:
 *   - Returns structured compliance report
 *   - Includes per-user daily hours, overtime flags, locked status
 *   - Only MANAGER can access
 *   - Excel export endpoint available
 *
 * Tests written BEFORE implementation (Red phase).
 */
import { createMockRequest } from "../utils/test-utils";

// ── Prisma mock ──────────────────────────────────────────────────────────────
const mockTimeEntry = {
  findMany: jest.fn(),
};
const mockUser = {
  findMany: jest.fn(),
};

jest.mock("@/lib/prisma", () => ({
  prisma: {
    timeEntry: mockTimeEntry,
    user: mockUser,
  },
}));

// ── Auth mock ────────────────────────────────────────────────────────────────
const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({
  getServerSession: (...a: unknown[]) => mockGetServerSession(...a),
}));

const SESSION_MANAGER = {
  user: { id: "mgr-1", name: "Manager", email: "mgr@t.com", role: "MANAGER" },
  expires: "2099",
};
const SESSION_ENGINEER = {
  user: { id: "eng-1", name: "Engineer", email: "e@t.com", role: "ENGINEER" },
  expires: "2099",
};

// Suppress console.error
jest.spyOn(console, "error").mockImplementation(() => {});

describe("GET /api/reports/timesheet-compliance (TS-28)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it("returns structured compliance report for MANAGER", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockUser.findMany.mockResolvedValue([
      { id: "eng-1", name: "Engineer A", role: "ENGINEER" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        userId: "eng-1",
        date: new Date("2026-03-23"),
        hours: 9,
        overtime: true,
        locked: true,
        category: "PLANNED_TASK",
        user: { id: "eng-1", name: "Engineer A" },
      },
      {
        id: "e2",
        userId: "eng-1",
        date: new Date("2026-03-24"),
        hours: 8,
        overtime: false,
        locked: false,
        category: "PLANNED_TASK",
        user: { id: "eng-1", name: "Engineer A" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/timesheet-compliance/route");
    const res = await GET(
      createMockRequest("/api/reports/timesheet-compliance", {
        searchParams: { startDate: "2026-03-23", endDate: "2026-03-27" },
      })
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.data.users).toBeDefined();
    expect(body.data.users.length).toBeGreaterThan(0);

    const user = body.data.users[0];
    expect(user.userId).toBe("eng-1");
    expect(user.totalHours).toBe(17);
    expect(user.dailyEntries).toBeDefined();
    expect(user.hasOvertime).toBe(true);
    expect(user.hasUnlocked).toBe(true);
  });

  it("returns 403 for ENGINEER", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_ENGINEER);

    const { GET } = await import("@/app/api/reports/timesheet-compliance/route");
    const res = await GET(
      createMockRequest("/api/reports/timesheet-compliance", {
        searchParams: { startDate: "2026-03-23", endDate: "2026-03-27" },
      })
    );

    expect(res.status).toBe(403);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const { GET } = await import("@/app/api/reports/timesheet-compliance/route");
    const res = await GET(
      createMockRequest("/api/reports/timesheet-compliance", {
        searchParams: { startDate: "2026-03-23", endDate: "2026-03-27" },
      })
    );

    expect(res.status).toBe(401);
  });

  it("includes locked status per entry in report", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockUser.findMany.mockResolvedValue([
      { id: "eng-1", name: "Engineer A", role: "ENGINEER" },
    ]);
    mockTimeEntry.findMany.mockResolvedValue([
      {
        id: "e1",
        userId: "eng-1",
        date: new Date("2026-03-23"),
        hours: 8,
        overtime: false,
        locked: true,
        category: "PLANNED_TASK",
        user: { id: "eng-1", name: "Engineer A" },
      },
    ]);

    const { GET } = await import("@/app/api/reports/timesheet-compliance/route");
    const res = await GET(
      createMockRequest("/api/reports/timesheet-compliance", {
        searchParams: { startDate: "2026-03-23", endDate: "2026-03-27" },
      })
    );

    const body = await res.json();
    const user = body.data.users[0];
    // All entries locked → hasUnlocked should be false
    expect(user.hasUnlocked).toBe(false);
  });

  it("returns empty users array when no entries exist", async () => {
    mockGetServerSession.mockResolvedValue(SESSION_MANAGER);
    mockUser.findMany.mockResolvedValue([]);
    mockTimeEntry.findMany.mockResolvedValue([]);

    const { GET } = await import("@/app/api/reports/timesheet-compliance/route");
    const res = await GET(
      createMockRequest("/api/reports/timesheet-compliance", {
        searchParams: { startDate: "2026-03-23", endDate: "2026-03-27" },
      })
    );

    const body = await res.json();
    expect(body.data.users).toEqual([]);
  });
});
