import { TimeEntryService } from "../time-entry-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("TimeEntryService", () => {
  let service: TimeEntryService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TimeEntryService(prisma as never);
  });

  test("listTimeEntries returns entries for user", async () => {
    const mockEntries = [{ id: "te-1", userId: "user-1", hours: 2 }];
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

    const result = await service.listTimeEntries({ userId: "user-1" }, "user-1", "ENGINEER");

    expect(prisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: "user-1" }),
      })
    );
    expect(result).toEqual(mockEntries);
  });

  test("createTimeEntry validates required fields", async () => {
    await expect(
      service.createTimeEntry({ userId: "", taskId: null, date: new Date(), hours: 2, category: "PLANNED_TASK" })
    ).rejects.toThrow(ValidationError);

    await expect(
      service.createTimeEntry({ userId: "user-1", taskId: null, date: new Date(), hours: 0, category: "PLANNED_TASK" })
    ).rejects.toThrow(ValidationError);
  });

  test("updateTimeEntry throws NotFoundError", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateTimeEntry("nonexistent", { hours: 3 }, "user-1", "ENGINEER")
    ).rejects.toThrow(NotFoundError);
  });

  test("deleteTimeEntry removes entry", async () => {
    (prisma.timeEntry.findFirst as jest.Mock).mockResolvedValue({ id: "te-1", userId: "user-1" });
    (prisma.timeEntry.delete as jest.Mock).mockResolvedValue({ id: "te-1" });

    await service.deleteTimeEntry("te-1", "user-1", "ENGINEER");

    expect(prisma.timeEntry.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "te-1" } })
    );
  });

  test("getStats returns aggregated hours", async () => {
    const mockEntries = [
      { hours: 2, category: "PLANNED_TASK" },
      { hours: 3, category: "INCIDENT" },
    ];
    (prisma.timeEntry.findMany as jest.Mock).mockResolvedValue(mockEntries);

    const result = await service.getStats({ userId: "user-1" }, "user-1", "ENGINEER");

    expect(result.totalHours).toBe(5);
    expect(result).toHaveProperty("byCategory");
  });
});
