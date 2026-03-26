import { TaskDocumentService } from "../task-document-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError, ConflictError } from "../errors";

describe("TaskDocumentService", () => {
  let service: TaskDocumentService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskDocumentService(prisma as never);
  });

  describe("listByTask", () => {
    test("returns documents linked to a task", async () => {
      const mockDocs = [
        { id: "td-1", taskId: "task-1", outlineDocumentId: "doc-1", title: "SOP" },
      ];
      (prisma.taskDocument.findMany as jest.Mock).mockResolvedValue(mockDocs);

      const result = await service.listByTask("task-1");

      expect(prisma.taskDocument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { taskId: "task-1" } })
      );
      expect(result).toEqual(mockDocs);
    });
  });

  describe("addDocument", () => {
    test("creates a task-document link", async () => {
      const input = {
        taskId: "task-1",
        outlineDocumentId: "doc-1",
        title: "SOP v2",
        addedBy: "user-1",
      };
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: "task-1" });
      (prisma.taskDocument.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.taskDocument.create as jest.Mock).mockResolvedValue({ id: "td-1", ...input });

      const result = await service.addDocument(input);

      expect(prisma.taskDocument.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: "task-1",
            outlineDocumentId: "doc-1",
            title: "SOP v2",
            addedBy: "user-1",
          }),
        })
      );
      expect(result.id).toBe("td-1");
    });

    test("throws ConflictError for duplicate link", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: "task-1" });
      (prisma.taskDocument.findUnique as jest.Mock).mockResolvedValue({ id: "td-existing" });

      await expect(
        service.addDocument({
          taskId: "task-1",
          outlineDocumentId: "doc-1",
          title: "SOP",
          addedBy: "user-1",
        })
      ).rejects.toThrow(ConflictError);
    });

    test("throws NotFoundError for non-existent task", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.addDocument({
          taskId: "nonexistent",
          outlineDocumentId: "doc-1",
          title: "SOP",
          addedBy: "user-1",
        })
      ).rejects.toThrow(NotFoundError);
    });

    test("throws ValidationError for empty taskId", async () => {
      await expect(
        service.addDocument({
          taskId: "",
          outlineDocumentId: "doc-1",
          title: "SOP",
          addedBy: "user-1",
        })
      ).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for empty outlineDocumentId", async () => {
      await expect(
        service.addDocument({
          taskId: "task-1",
          outlineDocumentId: "",
          title: "SOP",
          addedBy: "user-1",
        })
      ).rejects.toThrow(ValidationError);
    });

    test("throws ValidationError for empty title", async () => {
      await expect(
        service.addDocument({
          taskId: "task-1",
          outlineDocumentId: "doc-1",
          title: "",
          addedBy: "user-1",
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("removeDocument", () => {
    test("removes a document link", async () => {
      (prisma.taskDocument.findFirst as jest.Mock).mockResolvedValue({ id: "td-1" });
      (prisma.taskDocument.delete as jest.Mock).mockResolvedValue({ id: "td-1" });

      await service.removeDocument("task-1", "td-1");

      expect(prisma.taskDocument.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "td-1" } })
      );
    });

    test("throws NotFoundError for non-existent link", async () => {
      (prisma.taskDocument.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.removeDocument("task-1", "nonexistent")).rejects.toThrow(
        NotFoundError
      );
    });
  });
});
