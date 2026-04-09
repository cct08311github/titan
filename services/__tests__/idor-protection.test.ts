import { TimeEntryService } from "../time-entry-service";
import { createMockPrisma } from "../../lib/test-utils";
import { ForbiddenError } from "../errors";

describe("TimeEntryService IDOR protection", () => {
  let service: TimeEntryService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const engineerEntry = { id: "te-1", userId: "user-engineer", hours: 2, category: "PLANNED_TASK" };
  const otherEntry = { id: "te-2", userId: "user-other", hours: 3, category: "INCIDENT" };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TimeEntryService(prisma as never);
  });

  // ──────────────────────────────────────────────
  // READ
  // ──────────────────────────────────────────────

  test("ENGINEER can only read own time entries", async () => {
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([engineerEntry]);

    await service.listTimeEntries({ userId: "user-engineer" }, "user-engineer", "ENGINEER");

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-engineer" }),
      })
    );
  });

  test("ENGINEER cannot read other users time entries", async () => {
    await expect(
      service.listTimeEntries({ userId: "user-other" }, "user-engineer", "ENGINEER")
    ).rejects.toThrow(ForbiddenError);

    expect(prisma.timeEntry.findMany).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // UPDATE
  // ──────────────────────────────────────────────

  test("ENGINEER can only update own time entries", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(engineerEntry);
    (prisma.timeEntry.update as jest.Mock).mockResolvedValue({ ...engineerEntry, hours: 4 });

    const result = await service.updateTimeEntry("te-1", { hours: 4 }, "user-engineer", "ENGINEER");

    expect(result.hours).toBe(4);
    expect(prisma.timeEntry.update).toHaveBeenCalled();
  });

  test("ENGINEER cannot update other users time entries", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(otherEntry);

    await expect(
      service.updateTimeEntry("te-2", { hours: 4 }, "user-engineer", "ENGINEER")
    ).rejects.toThrow(ForbiddenError);

    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // DELETE
  // ──────────────────────────────────────────────

  test("ENGINEER cannot delete other users entries", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(otherEntry);

    await expect(
      service.deleteTimeEntry("te-2", "user-engineer", "ENGINEER")
    ).rejects.toThrow(ForbiddenError);

    expect(prisma.timeEntry.delete).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // MANAGER READ (exempt)
  // ──────────────────────────────────────────────

  test("MANAGER can read all time entries", async () => {
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([engineerEntry, otherEntry]);

    const result = await service.listTimeEntries({ userId: "user-other" }, "user-manager", "MANAGER");

    expect(result).toHaveLength(2);
    expect(prisma.timeEntry.findMany).toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // MANAGER WRITE (own only by default)
  // ──────────────────────────────────────────────

  test("MANAGER can only WRITE own entries by default", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(otherEntry);

    await expect(
      service.updateTimeEntry("te-2", { hours: 5 }, "user-manager", "MANAGER")
    ).rejects.toThrow(ForbiddenError);

    expect(prisma.timeEntry.update).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────
  // 403 not 404
  // ──────────────────────────────────────────────

  test("return 403 not 404 for unauthorized access", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(otherEntry);

    let caughtError: Error | undefined;
    try {
      await service.deleteTimeEntry("te-2", "user-engineer", "ENGINEER");
    } catch (e) {
      caughtError = e as Error;
    }

    expect(caughtError).toBeInstanceOf(ForbiddenError);
    expect(caughtError?.name).toBe("ForbiddenError");
  });

  // ──────────────────────────────────────────────
  // Batch operations
  // ──────────────────────────────────────────────

  test("batch operations respect ownership", async () => {
    // When an ENGINEER filters without specifying userId,
    // the query must be scoped to their own userId (not all entries)
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue([engineerEntry]);

    await service.listTimeEntries({}, "user-engineer", "ENGINEER");

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-engineer" }),
      })
    );
  });
});
