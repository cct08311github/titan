import { PrismaClient, TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";
import { ChangeTrackingService } from "./change-tracking-service";
import { AuditService } from "./audit-service";

export interface ListTasksFilter {
  assignee?: string;
  status?: TaskStatus | TaskStatus[] | string;
  priority?: Priority | Priority[] | string;
  category?: TaskCategory | TaskCategory[] | string;
  monthlyGoalId?: string;
  skip?: number;
  take?: number;
}

export interface CreateTaskInput {
  title: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  primaryAssigneeId?: string | null;
  backupAssigneeId?: string | null;
  creatorId: string;
  monthlyGoalId?: string | null;
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
  estimatedHours?: number | null;
  tags?: string[];
  addedReason?: string | null;
  addedSource?: string | null;
}

export interface UpdateTaskInput {
  title?: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  primaryAssigneeId?: string | null;
  backupAssigneeId?: string | null;
  monthlyGoalId?: string | null;
  dueDate?: Date | string | null;
  startDate?: Date | string | null;
  estimatedHours?: number | null;
  tags?: string[];
  addedReason?: string | null;
  addedSource?: string | null;
  progressPct?: number;
  changeReason?: string;
  changedBy?: string;
}

export class TaskService {
  private readonly changeTracker: ChangeTrackingService;
  private readonly auditor: AuditService;

  constructor(private readonly prisma: PrismaClient) {
    this.changeTracker = new ChangeTrackingService(prisma);
    this.auditor = new AuditService(prisma);
  }

  async listTasks(filter: ListTasksFilter) {
    const where: Record<string, unknown> = {};

    if (filter.assignee) {
      where.OR = [
        { primaryAssigneeId: filter.assignee },
        { backupAssigneeId: filter.assignee },
      ];
    }
    if (filter.status) {
      where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
    }
    if (filter.priority) {
      where.priority = Array.isArray(filter.priority) ? { in: filter.priority } : filter.priority;
    }
    if (filter.category) {
      where.category = Array.isArray(filter.category) ? { in: filter.category } : filter.category;
    }
    if (filter.monthlyGoalId) where.monthlyGoalId = filter.monthlyGoalId;

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          primaryAssignee: { select: { id: true, name: true, avatar: true } },
          backupAssignee: { select: { id: true, name: true, avatar: true } },
          creator: { select: { id: true, name: true } },
          monthlyGoal: { select: { id: true, title: true, month: true } },
          subTasks: { orderBy: { order: "asc" } },
          deliverables: true,
          incidentRecord: { select: { severity: true } },
          _count: { select: { subTasks: true, comments: true } },
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
        ...(filter.skip !== undefined && { skip: filter.skip }),
        ...(filter.take !== undefined && { take: filter.take }),
      }),
      this.prisma.task.count({ where }),
    ]);

    return { tasks, total };
  }

  async getTask(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true, email: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true, email: true } },
        creator: { select: { id: true, name: true } },
        monthlyGoal: {
          select: {
            id: true,
            title: true,
            month: true,
            annualPlan: { select: { id: true, title: true, year: true } },
          },
        },
        subTasks: { orderBy: { order: "asc" } },
        comments: {
          include: { user: { select: { id: true, name: true, avatar: true } } },
          orderBy: { createdAt: "asc" },
        },
        deliverables: true,
        incidentRecord: true,
        taskChanges: {
          include: { changedByUser: { select: { id: true, name: true } } },
          orderBy: { changedAt: "desc" },
        },
        kpiLinks: {
          include: { kpi: { select: { id: true, code: true, title: true } } },
        },
      },
    });

    if (!task) throw new NotFoundError(`Task not found: ${id}`);
    return task;
  }

  async createTask(input: CreateTaskInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }

    return this.prisma.task.create({
      data: {
        title: input.title,
        description: input.description,
        status: (input.status ?? "BACKLOG") as TaskStatus,
        priority: (input.priority ?? "P2") as Priority,
        category: (input.category ?? "PLANNED") as TaskCategory,
        primaryAssigneeId: input.primaryAssigneeId ?? null,
        backupAssigneeId: input.backupAssigneeId ?? null,
        creatorId: input.creatorId,
        monthlyGoalId: input.monthlyGoalId ?? null,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        startDate: input.startDate ? new Date(input.startDate) : null,
        estimatedHours: input.estimatedHours ?? null,
        tags: input.tags ?? [],
        addedDate:
          input.category === "ADDED" || input.category === "INCIDENT"
            ? new Date()
            : null,
        addedReason: input.addedReason ?? null,
        addedSource: input.addedSource ?? null,
      },
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true } },
        creator: { select: { id: true, name: true } },
      },
    });
  }

  async updateTask(id: string, input: UpdateTaskInput) {
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Task not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.category !== undefined) updates.category = input.category;
    if (input.primaryAssigneeId !== undefined) updates.primaryAssigneeId = input.primaryAssigneeId ?? null;
    if (input.backupAssigneeId !== undefined) updates.backupAssigneeId = input.backupAssigneeId ?? null;
    if (input.monthlyGoalId !== undefined) updates.monthlyGoalId = input.monthlyGoalId ?? null;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate ? new Date(input.dueDate as string) : null;
    if (input.startDate !== undefined) updates.startDate = input.startDate ? new Date(input.startDate as string) : null;
    if (input.estimatedHours !== undefined) updates.estimatedHours = input.estimatedHours ?? null;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.addedReason !== undefined) updates.addedReason = input.addedReason;
    if (input.addedSource !== undefined) updates.addedSource = input.addedSource;
    if (input.progressPct !== undefined) updates.progressPct = input.progressPct;

    const task = await this.prisma.task.update({
      where: { id },
      data: updates,
      include: {
        primaryAssignee: { select: { id: true, name: true, avatar: true } },
        backupAssignee: { select: { id: true, name: true, avatar: true } },
        subTasks: true,
        deliverables: true,
      },
    });

    // Auto-detect delay/scope-change and record if changedBy is provided
    if (input.changedBy) {
      const reason = input.changeReason;

      if (input.dueDate !== undefined) {
        const oldDueDate = existing.dueDate ?? null;
        const newDueDate = input.dueDate ? new Date(input.dueDate as string) : null;
        await this.changeTracker.detectDelay({
          taskId: id,
          oldDueDate,
          newDueDate,
          changedBy: input.changedBy,
          reason,
        });
      }

      if (input.title !== undefined || input.description !== undefined) {
        await this.changeTracker.detectScopeChange({
          taskId: id,
          oldTitle: existing.title,
          newTitle: input.title ?? existing.title,
          oldDescription: existing.description ?? null,
          newDescription: input.description !== undefined ? (input.description ?? null) : (existing.description ?? null),
          changedBy: input.changedBy,
          reason,
        });
      }
    }

    return task;
  }

  async updateTaskStatus(id: string, status: string, userId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const task = await tx.task.update({
          where: { id },
          data: { status: status as TaskStatus },
          include: {
            primaryAssignee: { select: { id: true, name: true, avatar: true } },
            backupAssignee: { select: { id: true, name: true, avatar: true } },
          },
        });

        await tx.taskActivity.create({
          data: {
            taskId: id,
            userId,
            action: "STATUS_CHANGED",
            detail: { status },
          },
        });

        return task;
      },
      { timeout: 10000 }
    );
  }

  async deleteTask(id: string, deletedBy?: string, ipAddress?: string) {
    const task = await this.prisma.task.findUnique({ where: { id }, select: { id: true, title: true } });
    const result = await this.prisma.task.delete({ where: { id } });

    await this.auditor.log({
      userId: deletedBy ?? null,
      action: "DELETE_TASK",
      resourceType: "Task",
      resourceId: id,
      detail: task ? `Deleted task: ${task.title}` : `Deleted task: ${id}`,
      ipAddress: ipAddress ?? null,
    });

    return result;
  }
}
