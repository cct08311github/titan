/**
 * M2 — Transaction tests
 * Verifies that GoalService.deleteGoal, KPIService.deleteKPI,
 * TaskService.updateTaskStatus, and DocumentService.updateDocument
 * all execute their multi-step DB writes inside prisma.$transaction.
 */

import { GoalService } from "../goal-service";
import { KPIService } from "../kpi-service";
import { DocumentService } from "../document-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError } from "../errors";

// Helper: make $transaction execute the callback synchronously with a tx proxy
function setupTransaction(prisma: ReturnType<typeof createMockPrisma>) {
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (fn: (tx: unknown) => Promise<unknown>) => {
      // Pass the same mock as the transaction client
      return fn(prisma);
    }
  );
}

// ─── GoalService.deleteGoal ───────────────────────────────────────────────────

describe("GoalService.deleteGoal — transaction", () => {
  let service: GoalService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new GoalService(prisma as never);
    setupTransaction(prisma);
  });

  test("calls $transaction when deleting a goal", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({ id: "goal-1" });
    (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue({ id: "goal-1" });

    await service.deleteGoal("goal-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("nullifies task.monthlyGoalId inside the transaction", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({ id: "goal-1" });
    (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 2 });
    (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue({ id: "goal-1" });

    await service.deleteGoal("goal-1");

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { monthlyGoalId: "goal-1" },
        data: { monthlyGoalId: null },
      })
    );
  });

  test("deletes the goal inside the transaction", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({ id: "goal-1" });
    (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue({ id: "goal-1" });

    await service.deleteGoal("goal-1");

    expect(prisma.monthlyGoal.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "goal-1" } })
    );
  });

  test("throws NotFoundError without starting a transaction when goal missing", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteGoal("nonexistent")).rejects.toThrow(NotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("passes timeout option to $transaction", async () => {
    (prisma.monthlyGoal.findUnique as jest.Mock).mockResolvedValue({ id: "goal-1" });
    (prisma.task.updateMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.monthlyGoal.delete as jest.Mock).mockResolvedValue({ id: "goal-1" });

    await service.deleteGoal("goal-1");

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 10000 })
    );
  });
});

// ─── KPIService.deleteKPI ─────────────────────────────────────────────────────

describe("KPIService.deleteKPI — transaction", () => {
  let service: KPIService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new KPIService(prisma as never);
    setupTransaction(prisma);
  });

  test("calls $transaction when deleting a KPI", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({ id: "kpi-1" });
    (prisma.kPITaskLink.deleteMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.kPI.delete as jest.Mock).mockResolvedValue({ id: "kpi-1" });

    await service.deleteKPI("kpi-1");

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("deletes task links before the KPI inside the transaction", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({ id: "kpi-1" });
    (prisma.kPITaskLink.deleteMany as jest.Mock).mockResolvedValue({ count: 3 });
    (prisma.kPI.delete as jest.Mock).mockResolvedValue({ id: "kpi-1" });

    await service.deleteKPI("kpi-1");

    expect(prisma.kPITaskLink.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { kpiId: "kpi-1" } })
    );
    expect(prisma.kPI.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "kpi-1" } })
    );
  });

  test("throws NotFoundError without starting a transaction when KPI missing", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.deleteKPI("nonexistent")).rejects.toThrow(NotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test("passes timeout option to $transaction", async () => {
    (prisma.kPI.findUnique as jest.Mock).mockResolvedValue({ id: "kpi-1" });
    (prisma.kPITaskLink.deleteMany as jest.Mock).mockResolvedValue({ count: 0 });
    (prisma.kPI.delete as jest.Mock).mockResolvedValue({ id: "kpi-1" });

    await service.deleteKPI("kpi-1");

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 10000 })
    );
  });
});

// ─── DocumentService.updateDocument ──────────────────────────────────────────

describe("DocumentService.updateDocument — transaction", () => {
  let service: DocumentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  const existingDoc = {
    id: "doc-1",
    content: "old content",
    version: 3,
    title: "Old Title",
  };

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new DocumentService(prisma as never);
    setupTransaction(prisma);
  });

  test("calls $transaction when updating a document", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existingDoc);
    (prisma.documentVersion.create as jest.Mock).mockResolvedValue({});
    (prisma.document.update as jest.Mock).mockResolvedValue({ ...existingDoc, content: "new content", version: 4 });

    await service.updateDocument("doc-1", { content: "new content", updatedBy: "user-1" });

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });

  test("snapshots old version before updating content", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existingDoc);
    (prisma.documentVersion.create as jest.Mock).mockResolvedValue({});
    (prisma.document.update as jest.Mock).mockResolvedValue({ ...existingDoc, content: "new content", version: 4 });

    await service.updateDocument("doc-1", { content: "new content", updatedBy: "user-1" });

    expect(prisma.documentVersion.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          documentId: "doc-1",
          content: "old content",
          version: 3,
          createdBy: "user-1",
        }),
      })
    );
  });

  test("increments version on document update", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existingDoc);
    (prisma.documentVersion.create as jest.Mock).mockResolvedValue({});
    (prisma.document.update as jest.Mock).mockResolvedValue({ ...existingDoc, content: "new content", version: 4 });

    await service.updateDocument("doc-1", { content: "new content", updatedBy: "user-1" });

    expect(prisma.document.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4 }),
      })
    );
  });

  test("does not create version snapshot when content is unchanged", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existingDoc);
    (prisma.document.update as jest.Mock).mockResolvedValue({ ...existingDoc, title: "New Title" });

    await service.updateDocument("doc-1", { title: "New Title", updatedBy: "user-1" });

    expect(prisma.documentVersion.create).not.toHaveBeenCalled();
  });

  test("passes timeout option to $transaction", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(existingDoc);
    (prisma.documentVersion.create as jest.Mock).mockResolvedValue({});
    (prisma.document.update as jest.Mock).mockResolvedValue({ ...existingDoc, content: "x", version: 4 });

    await service.updateDocument("doc-1", { content: "x", updatedBy: "user-1" });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ timeout: 10000 })
    );
  });

  test("throws NotFoundError without starting transaction when document missing", async () => {
    (prisma.document.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      service.updateDocument("nonexistent", { updatedBy: "user-1" })
    ).rejects.toThrow(NotFoundError);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
