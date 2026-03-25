/**
 * TDD Tests for TS-05: Timer unique constraint + start/stop
 * and TS-04: locked boolean
 *
 * RED phase: these tests should FAIL before implementation.
 */
import { TimeEntryService } from "../time-entry-service";
import { createMockPrisma } from "../../lib/test-utils";
import { ForbiddenError, ValidationError } from "../errors";

describe("Timer — start/stop (TS-05)", () => {
  let service: TimeEntryService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TimeEntryService(prisma as never);
  });

  test("startTimer creates entry with isRunning=true and startTime", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(null);
    (prisma.timeEntry.create as jest.Mock).mockResolvedValue({
      id: "te-new",
      isRunning: true,
      startTime: new Date(),
      endTime: null,
    });

    const result = await service.startTimer({
      userId: "user-1",
      taskId: "task-1",
      category: "PLANNED_TASK",
    });

    expect(result.isRunning).toBe(true);
    expect(prisma.timeEntry.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isRunning: true,
          userId: "user-1",
        }),
      })
    );
  });

  test("startTimer throws when user already has a running timer", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue({
      id: "te-existing",
      isRunning: true,
      userId: "user-1",
    });

    await expect(
      service.startTimer({
        userId: "user-1",
        taskId: "task-1",
        category: "PLANNED_TASK",
      })
    ).rejects.toThrow(ValidationError);
  });

  test("stopTimer sets endTime, calculates hours, and sets isRunning=false", async () => {
    const startTime = new Date("2026-03-25T09:00:00Z");
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue({
      id: "te-running",
      isRunning: true,
      startTime,
      userId: "user-1",
    });
    (prisma.timeEntry.update as jest.Mock).mockImplementation(({ data }) => ({
      id: "te-running",
      isRunning: false,
      startTime,
      endTime: data.endTime,
      hours: data.hours,
    }));

    const result = await service.stopTimer("user-1");

    expect(result.isRunning).toBe(false);
    expect(result.endTime).toBeDefined();
    expect(result.hours).toBeGreaterThan(0);
    expect(prisma.timeEntry.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "te-running" },
        data: expect.objectContaining({
          isRunning: false,
        }),
      })
    );
  });

  test("stopTimer throws when no running timer exists", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.stopTimer("user-1")).rejects.toThrow();
  });

  test("getRunningTimer returns the running entry for user", async () => {
    const mockEntry = { id: "te-1", isRunning: true, userId: "user-1" };
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(mockEntry);

    const result = await service.getRunningTimer("user-1");

    expect(result).toEqual(mockEntry);
    expect(prisma.timeEntry.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1", isRunning: true },
      })
    );
  });
});

describe("Locked entries (TS-04)", () => {
  let service: TimeEntryService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TimeEntryService(prisma as never);
  });

  test("updateTimeEntry throws ForbiddenError when entry is locked", async () => {
    (prisma.timeEntry.findUnique as jest.Mock).mockResolvedValue({
      id: "te-locked",
      userId: "user-1",
      locked: true,
    });

    await expect(
      service.updateTimeEntry("te-locked", { hours: 5 }, "user-1", "ENGINEER")
    ).rejects.toThrow(ForbiddenError);
  });

  test("deleteTimeEntry throws ForbiddenError when entry is locked", async () => {
    (prisma.timeEntry.findUnique as jest.Mock).mockResolvedValue({
      id: "te-locked",
      userId: "user-1",
      locked: true,
    });

    await expect(
      service.deleteTimeEntry("te-locked", "user-1", "ENGINEER")
    ).rejects.toThrow(ForbiddenError);
  });

  test("updateTimeEntry succeeds when entry is not locked", async () => {
    (prisma.timeEntry.findUnique as jest.Mock).mockResolvedValue({
      id: "te-unlocked",
      userId: "user-1",
      locked: false,
    });
    (prisma.timeEntry.update as jest.Mock).mockResolvedValue({
      id: "te-unlocked",
      hours: 5,
    });

    const result = await service.updateTimeEntry(
      "te-unlocked",
      { hours: 5 },
      "user-1",
      "ENGINEER"
    );
    expect(result.hours).toBe(5);
  });
});
