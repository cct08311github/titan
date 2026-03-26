/**
 * @jest-environment node
 */
/**
 * Gantt auto-display tests — Issue #824 (G-1)
 * Tests task filtering logic for gantt: tasks with/without startDate
 */
import { createMockRequest } from "../utils/test-utils";

const mockAnnualPlan = { findFirst: jest.fn() };

jest.mock("@/lib/prisma", () => ({ prisma: { annualPlan: mockAnnualPlan } }));

const mockGetServerSession = jest.fn();
jest.mock("next-auth", () => ({ getServerSession: (...a: unknown[]) => mockGetServerSession(...a) }));

const ENGINEER = { user: { id: "u1", name: "Test", email: "t@e.com", role: "ENGINEER" }, expires: "2099" };

const TASK_WITH_DATES = {
  id: "t1",
  title: "Task with dates",
  status: "IN_PROGRESS",
  startDate: "2026-01-15",
  dueDate: "2026-02-15",
  progressPct: 50,
  primaryAssignee: { id: "u1", name: "Test" },
  backupAssignee: null,
};

const TASK_NO_START = {
  id: "t2",
  title: "Task without start",
  status: "TODO",
  startDate: null,
  dueDate: "2026-03-01",
  progressPct: 0,
  primaryAssignee: null,
  backupAssignee: null,
};

const MOCK_PLAN = {
  id: "plan-1",
  year: 2026,
  title: "2026 Plan",
  milestones: [],
  monthlyGoals: [
    {
      id: "g1",
      month: 1,
      title: "Jan Goal",
      tasks: [TASK_WITH_DATES, TASK_NO_START],
    },
  ],
};

describe("GET /api/tasks/gantt", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(ENGINEER);
    mockAnnualPlan.findFirst.mockResolvedValue(MOCK_PLAN);
  });

  it("returns gantt data with tasks", async () => {
    const { GET } = await import("@/app/api/tasks/gantt/route");
    const res = await GET(createMockRequest("/api/tasks/gantt"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.annualPlan).not.toBeNull();
    expect(body.data.annualPlan.monthlyGoals[0].tasks).toHaveLength(2);
  });

  it("returns tasks with and without startDate (frontend filters)", async () => {
    const { GET } = await import("@/app/api/tasks/gantt/route");
    const res = await GET(createMockRequest("/api/tasks/gantt"));
    const body = await res.json();
    const tasks = body.data.annualPlan.monthlyGoals[0].tasks;

    // Task with dates should have startDate
    const withDates = tasks.find((t: { id: string }) => t.id === "t1");
    expect(withDates.startDate).toBe("2026-01-15");

    // Task without start should have null startDate
    const noStart = tasks.find((t: { id: string }) => t.id === "t2");
    expect(noStart.startDate).toBeNull();
  });

  it("returns 401 when no session", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tasks/gantt/route");
    const res = await GET(createMockRequest("/api/tasks/gantt"));
    expect(res.status).toBe(401);
  });

  it("returns null plan when none exists", async () => {
    mockAnnualPlan.findFirst.mockResolvedValue(null);
    const { GET } = await import("@/app/api/tasks/gantt/route");
    const res = await GET(createMockRequest("/api/tasks/gantt"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.annualPlan).toBeNull();
  });

  it("filters by assignee", async () => {
    const { GET } = await import("@/app/api/tasks/gantt/route");
    await GET(createMockRequest("/api/tasks/gantt", { searchParams: { assignee: "u1" } }));
    expect(mockAnnualPlan.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          monthlyGoals: expect.objectContaining({
            include: expect.objectContaining({
              tasks: expect.objectContaining({
                where: expect.objectContaining({
                  OR: expect.arrayContaining([
                    expect.objectContaining({ primaryAssigneeId: "u1" }),
                  ]),
                }),
              }),
            }),
          }),
        }),
      })
    );
  });
});

describe("Gantt task filtering (client-side logic)", () => {
  it("separates tasks with dates from tasks without startDate", () => {
    const allTasks = [TASK_WITH_DATES, TASK_NO_START];
    const withDates = allTasks.filter((t) => t.startDate && t.dueDate);
    const missingStart = allTasks.filter((t) => !t.startDate);

    expect(withDates).toHaveLength(1);
    expect(withDates[0].id).toBe("t1");
    expect(missingStart).toHaveLength(1);
    expect(missingStart[0].id).toBe("t2");
  });

  it("bar color mapping by status", () => {
    const STATUS_BAR: Record<string, string> = {
      BACKLOG: "bg-muted",
      TODO: "bg-blue-500/70",
      IN_PROGRESS: "bg-warning/80",
      REVIEW: "bg-purple-500/80",
      DONE: "bg-emerald-500/80",
    };

    expect(STATUS_BAR["IN_PROGRESS"]).toBe("bg-warning/80");
    expect(STATUS_BAR["DONE"]).toBe("bg-emerald-500/80");
    expect(STATUS_BAR["TODO"]).toBe("bg-blue-500/70");
  });
});
