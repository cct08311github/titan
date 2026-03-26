/**
 * Tests for completion rate calculation — R-1 (#836)
 */
import { getWeekBounds, getCompletionRateData } from "../completion-rate";
import { createMockPrisma } from "../test-utils";

/** Helper: format local date as YYYY-MM-DD */
function localDateStr(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

describe("getWeekBounds", () => {
  it("returns Monday-Sunday for a Wednesday", () => {
    // Use local date constructor to avoid UTC offset issues
    const { start, end } = getWeekBounds(new Date(2026, 2, 25)); // Wed Mar 25 2026
    expect(start.getDay()).toBe(1); // Monday
    expect(end.getDay()).toBe(0);   // Sunday
    expect(localDateStr(start)).toBe("2026-03-23");
    expect(localDateStr(end)).toBe("2026-03-29");
  });

  it("returns Monday-Sunday for a Sunday", () => {
    const { start, end } = getWeekBounds(new Date(2026, 2, 29)); // Sun Mar 29 2026
    expect(localDateStr(start)).toBe("2026-03-23");
    expect(localDateStr(end)).toBe("2026-03-29");
  });

  it("returns Monday-Sunday for a Monday", () => {
    const { start, end } = getWeekBounds(new Date(2026, 2, 23)); // Mon Mar 23 2026
    expect(localDateStr(start)).toBe("2026-03-23");
    expect(localDateStr(end)).toBe("2026-03-29");
  });
});

describe("getCompletionRateData", () => {
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
  });

  it("returns 0% for periods with no tasks", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getCompletionRateData(
      prisma as never,
      new Date("2026-01-01"),
      new Date("2026-03-31"),
      "month",
      {},
    );

    expect(result.length).toBe(3);
    expect(result[0].completionRate).toBe(0);
    expect(result[0].totalCount).toBe(0);
    expect(result[0].completedCount).toBe(0);
    expect(result[0].label).toBe("2026/01");
  });

  it("calculates correct completion rate for monthly granularity", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      { id: "1", status: "DONE", createdAt: new Date("2026-01-05"), updatedAt: new Date("2026-01-20"), dueDate: new Date("2026-01-15") },
      { id: "2", status: "DONE", createdAt: new Date("2026-01-10"), updatedAt: new Date("2026-01-25"), dueDate: new Date("2026-01-31") },
      { id: "3", status: "IN_PROGRESS", createdAt: new Date("2026-01-03"), updatedAt: new Date("2026-01-15"), dueDate: new Date("2026-01-20") },
    ]);

    const result = await getCompletionRateData(
      prisma as never,
      new Date("2026-01-01"),
      new Date("2026-01-31"),
      "month",
      {},
    );

    expect(result.length).toBe(1);
    expect(result[0].totalCount).toBe(3);
    expect(result[0].completedCount).toBe(2);
    // 2/3 * 100 = 66.7%
    expect(result[0].completionRate).toBe(66.7);
  });

  it("handles divide-by-zero when no tasks in period", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getCompletionRateData(
      prisma as never,
      new Date("2026-02-01"),
      new Date("2026-02-28"),
      "month",
      {},
    );

    expect(result[0].completionRate).toBe(0);
    expect(result[0].totalCount).toBe(0);
  });

  it("generates weekly buckets correctly", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    const result = await getCompletionRateData(
      prisma as never,
      new Date("2026-03-02"), // Monday
      new Date("2026-03-22"), // Sunday
      "week",
      {},
    );

    expect(result.length).toBe(3);
    expect(result[0].label).toBe("3/2");
    expect(result[1].label).toBe("3/9");
    expect(result[2].label).toBe("3/16");
  });

  it("respects user filter parameter", async () => {
    (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

    await getCompletionRateData(
      prisma as never,
      new Date("2026-01-01"),
      new Date("2026-01-31"),
      "month",
      { primaryAssigneeId: "user-123" },
    );

    expect(prisma.task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          primaryAssigneeId: "user-123",
        }),
      }),
    );
  });

  it("empty periods show 0% not gaps", async () => {
    // Task only in January, querying Jan-Mar
    (prisma.task.findMany as jest.Mock).mockResolvedValue([
      { id: "1", status: "DONE", createdAt: new Date("2026-01-05"), updatedAt: new Date("2026-01-20"), dueDate: new Date("2026-01-15") },
    ]);

    const result = await getCompletionRateData(
      prisma as never,
      new Date("2026-01-01"),
      new Date("2026-03-31"),
      "month",
      {},
    );

    expect(result.length).toBe(3);
    expect(result[0].completionRate).toBe(100); // Jan: 1/1
    expect(result[1].completionRate).toBe(0);   // Feb: 0/0 → 0%
    expect(result[2].completionRate).toBe(0);   // Mar: 0/0 → 0%
  });
});
