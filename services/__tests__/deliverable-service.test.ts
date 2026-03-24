import { DeliverableService } from "../deliverable-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("DeliverableService", () => {
  let service: DeliverableService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DeliverableService(prisma as never);
  });

  test("listDeliverables returns all for a task", async () => {
    const mockDeliverables = [
      { id: "d-1", title: "Doc A", type: "DOCUMENT", taskId: "task-1" },
      { id: "d-2", title: "Report B", type: "REPORT", taskId: "task-1" },
    ];
    (prisma.deliverable.findMany as jest.Mock).mockResolvedValue(mockDeliverables);

    const result = await service.listDeliverables({ taskId: "task-1" });

    expect(prisma.deliverable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ taskId: "task-1" }),
      })
    );
    expect(result).toEqual(mockDeliverables);
  });

  test("listDeliverables filters by status", async () => {
    (prisma.deliverable.findMany as jest.Mock).mockResolvedValue([]);

    await service.listDeliverables({ status: "IN_PROGRESS" });

    expect(prisma.deliverable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "IN_PROGRESS" }),
      })
    );
  });

  test("listDeliverables filters by type", async () => {
    (prisma.deliverable.findMany as jest.Mock).mockResolvedValue([]);

    await service.listDeliverables({ type: "DOCUMENT" });

    expect(prisma.deliverable.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "DOCUMENT" }),
      })
    );
  });

  test("getDeliverable returns by id", async () => {
    const mockDeliverable = {
      id: "d-1",
      title: "Doc A",
      type: "DOCUMENT",
      status: "NOT_STARTED",
      taskId: "task-1",
    };
    (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(mockDeliverable);

    const result = await service.getDeliverable("d-1");

    expect(prisma.deliverable.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d-1" } })
    );
    expect(result).toEqual(mockDeliverable);
  });

  test("getDeliverable throws NotFoundError", async () => {
    (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.getDeliverable("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("createDeliverable with required fields", async () => {
    const mockDeliverable = {
      id: "d-new",
      title: "New Doc",
      type: "DOCUMENT",
      status: "NOT_STARTED",
    };
    (prisma.deliverable.create as jest.Mock).mockResolvedValue(mockDeliverable);

    const result = await service.createDeliverable({ title: "New Doc", type: "DOCUMENT" });

    expect(prisma.deliverable.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "New Doc", type: "DOCUMENT" }),
      })
    );
    expect(result).toEqual(mockDeliverable);
  });

  test("createDeliverable throws ValidationError when title is missing", async () => {
    await expect(
      service.createDeliverable({ title: "", type: "DOCUMENT" })
    ).rejects.toThrow(ValidationError);
  });

  test("updateDeliverable changes status", async () => {
    const existing = { id: "d-1", title: "Doc A", status: "NOT_STARTED" };
    const updated = { id: "d-1", title: "Doc A", status: "IN_PROGRESS" };
    (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(existing);
    (prisma.deliverable.update as jest.Mock).mockResolvedValue(updated);

    const result = await service.updateDeliverable("d-1", { status: "IN_PROGRESS" });

    expect(prisma.deliverable.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "d-1" },
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      })
    );
    expect(result).toEqual(updated);
  });

  test("deleteDeliverable removes", async () => {
    (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue({ id: "d-1" });
    (prisma.deliverable.delete as jest.Mock).mockResolvedValue({ id: "d-1" });

    await service.deleteDeliverable("d-1");

    expect(prisma.deliverable.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "d-1" } })
    );
  });

  test("deleteDeliverable throws NotFoundError when not found", async () => {
    (prisma.deliverable.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteDeliverable("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
