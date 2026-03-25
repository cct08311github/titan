import { TaskService } from "../task-service";
import { createMockPrisma } from "../../lib/test-utils";
import { NotFoundError, ValidationError } from "../errors";

describe("TaskService", () => {
  let service: TaskService;
  let prisma: ReturnType<typeof createMockPrisma>;

  beforeEach(() => {
    prisma = createMockPrisma();
    service = new TaskService(prisma as never);
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (fn: (tx: unknown) => Promise<unknown>) => fn(prisma)
    );
  });

  describe("listTasks", () => {
    test("listTasks returns filtered tasks", async () => {
      const mockTasks = [
        { id: "task-1", title: "Task 1", status: "TODO" },
        { id: "task-2", title: "Task 2", status: "IN_PROGRESS" },
      ];
      (prisma.task.findMany as jest.Mock).mockResolvedValue(mockTasks);

      (prisma.task.count as jest.Mock).mockResolvedValue(2);
      const result = await service.listTasks({});

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: {} })
      );
      expect(result).toEqual({ tasks: mockTasks, total: 2 });
    });

    test("listTasks filters by assignee", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.listTasks({ assignee: "user-123" });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { primaryAssigneeId: "user-123" },
              { backupAssigneeId: "user-123" },
            ]),
          }),
        })
      );
    });

    test("listTasks filters by status", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.listTasks({ status: "IN_PROGRESS" });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: "IN_PROGRESS" }),
        })
      );
    });

    test("listTasks filters by category", async () => {
      (prisma.task.findMany as jest.Mock).mockResolvedValue([]);

      await service.listTasks({ category: "PLANNED" });

      expect(prisma.task.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ category: "PLANNED" }),
        })
      );
    });
  });

  describe("getTask", () => {
    test("getTask returns task with relations", async () => {
      const mockTask = {
        id: "task-1",
        title: "Task 1",
        primaryAssignee: { id: "u1", name: "Alice" },
        subTasks: [],
        comments: [],
      };
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.getTask("task-1");

      expect(prisma.task.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "task-1" } })
      );
      expect(result).toEqual(mockTask);
    });

    test("getTask throws NotFoundError for invalid id", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getTask("nonexistent")).rejects.toThrow(NotFoundError);
    });
  });

  describe("createTask", () => {
    test("createTask creates with required fields", async () => {
      const mockTask = { id: "task-1", title: "New Task", status: "BACKLOG" };
      (prisma.task.create as jest.Mock).mockResolvedValue(mockTask);

      const result = await service.createTask({
        title: "New Task",
        creatorId: "user-1",
      });

      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            title: "New Task",
            creatorId: "user-1",
          }),
        })
      );
      expect(result).toEqual(mockTask);
    });

    test("createTask validates required fields", async () => {
      await expect(
        service.createTask({ title: "", creatorId: "user-1" })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe("updateTask", () => {
    test("updateTask updates only provided fields", async () => {
      const existing = { id: "task-1", title: "Old Title", dueDate: null };
      const updated = { id: "task-1", title: "New Title", dueDate: null };
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(existing);
      (prisma.task.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateTask("task-1", { title: "New Title" });

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-1" },
          data: expect.objectContaining({ title: "New Title" }),
        })
      );
      expect(result).toEqual(updated);
    });

    test("updateTask throws NotFoundError", async () => {
      (prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateTask("nonexistent", { title: "X" })
      ).rejects.toThrow(NotFoundError);
    });
  });

  describe("updateTaskStatus", () => {
    test("updateTaskStatus changes status", async () => {
      const mockTask = { id: "task-1", status: "IN_PROGRESS" };
      (prisma.task.update as jest.Mock).mockResolvedValue(mockTask);
      (prisma.taskActivity.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateTaskStatus("task-1", "IN_PROGRESS", "user-1");

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: "task-1" },
          data: { status: "IN_PROGRESS" },
        })
      );
      expect(result).toEqual(mockTask);
    });

    test("updateTaskStatus creates activity log", async () => {
      const mockTask = { id: "task-1", status: "DONE" };
      (prisma.task.update as jest.Mock).mockResolvedValue(mockTask);
      (prisma.taskActivity.create as jest.Mock).mockResolvedValue({});

      await service.updateTaskStatus("task-1", "DONE", "user-1");

      expect(prisma.taskActivity.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            taskId: "task-1",
            userId: "user-1",
            action: "STATUS_CHANGED",
          }),
        })
      );
    });
  });

  describe("deleteTask", () => {
    test("deleteTask soft deletes", async () => {
      (prisma.task.delete as jest.Mock).mockResolvedValue({ id: "task-1" });

      await service.deleteTask("task-1");

      expect(prisma.task.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "task-1" } })
      );
    });
  });
});
