import { PrismaClient, TaskStatus, Priority, TaskCategory } from "@prisma/client";
import { ConflictError, NotFoundError, ValidationError } from "./errors";
import { ChangeTrackingService } from "./change-tracking-service";
import { AuditService } from "./audit-service";
import { logActivity, ActivityAction, ActivityModule } from "./activity-logger";
import { AutoRollupService } from "@/lib/auto-rollup";
import { isValidTaskTransition } from "@/lib/state-machines";

export interface ListTasksFilter {
  assignee?: string;
  status?: TaskStatus | TaskStatus[] | string;
  priority?: Priority | Priority[] | string;
  category?: TaskCategory | TaskCategory[] | string;
  annualPlanId?: string; // Issue #835
  monthlyGoalId?: string;
  projectId?: string; // Issue #1176
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
  annualPlanId?: string | null; // Issue #835
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
  description?: string | null;
  status?: string;
  priority?: string;
  category?: string;
  primaryAssigneeId?: string | null;
  backupAssigneeId?: string | null;
  annualPlanId?: string | null; // Issue #835
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
  private readonly rollup: AutoRollupService;

  constructor(private readonly prisma: PrismaClient) {
    this.changeTracker = new ChangeTrackingService(prisma);
    this.auditor = new AuditService(prisma);
    this.rollup = new AutoRollupService(prisma);
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
    if (filter.annualPlanId) where.annualPlanId = filter.annualPlanId; // Issue #835
    if (filter.monthlyGoalId) where.monthlyGoalId = filter.monthlyGoalId;
    if (filter.projectId) where.projectId = filter.projectId; // Issue #1176

    const [tasks, total] = await Promise.all([
      this.prisma.task.findMany({
        where,
        include: {
          primaryAssignee: { select: { id: true, name: true, avatar: true } },
          backupAssignee: { select: { id: true, name: true, avatar: true } },
          creator: { select: { id: true, name: true } },
          annualPlan: { select: { id: true, title: true, year: true } }, // Issue #835
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
        attachments: {
          include: { uploader: { select: { id: true, name: true } } },
          orderBy: { createdAt: "desc" },
        },
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

    // Defense-in-depth: strip HTML tags from user text (Issue #1148)
    const { sanitizeHtml } = await import("@/lib/security/sanitize");
    const title = sanitizeHtml(input.title);
    const description = input.description ? sanitizeHtml(input.description) : input.description;

    return this.prisma.task.create({
      data: {
        title,
        description,
        status: (input.status ?? "BACKLOG") as TaskStatus,
        priority: (input.priority ?? "P2") as Priority,
        category: (input.category ?? "PLANNED") as TaskCategory,
        primaryAssigneeId: input.primaryAssigneeId ?? null,
        backupAssigneeId: input.backupAssigneeId ?? null,
        creatorId: input.creatorId,
        annualPlanId: input.annualPlanId ?? null, // Issue #835
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

  /**
   * Update a task with optimistic concurrency control.
   * @param expectedUpdatedAt - If provided, update fails with ConflictError when the
   *        task's current updatedAt differs from the expected value (stale client cache).
   */
  async updateTask(id: string, input: UpdateTaskInput, expectedUpdatedAt?: string | Date) {
    // Optimistic concurrency: use updatedAt in the WHERE clause so the update
    // only succeeds when no other writer has changed the row since the client
    // last fetched it (ETag semantics).
    // ── Fetch existing for field-change tracking ────
    const existing = await this.prisma.task.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Task not found: ${id}`);

    // Enforce state machine when status is being changed — Issue #1156
    if (input.status !== undefined && input.status !== existing.status) {
      if (!isValidTaskTransition(existing.status as Parameters<typeof isValidTaskTransition>[0], input.status as Parameters<typeof isValidTaskTransition>[0])) {
        throw new ValidationError(
          `無法從 ${existing.status} 轉換為 ${input.status}，請參考狀態機定義`
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.status !== undefined) updates.status = input.status;
    if (input.priority !== undefined) updates.priority = input.priority;
    if (input.category !== undefined) updates.category = input.category;
    if (input.primaryAssigneeId !== undefined) updates.primaryAssigneeId = input.primaryAssigneeId ?? null;
    if (input.backupAssigneeId !== undefined) updates.backupAssigneeId = input.backupAssigneeId ?? null;
    if (input.annualPlanId !== undefined) updates.annualPlanId = input.annualPlanId ?? null; // Issue #835
    if (input.monthlyGoalId !== undefined) updates.monthlyGoalId = input.monthlyGoalId ?? null;
    if (input.dueDate !== undefined) updates.dueDate = input.dueDate ? new Date(input.dueDate as string) : null;
    if (input.startDate !== undefined) updates.startDate = input.startDate ? new Date(input.startDate as string) : null;
    if (input.estimatedHours !== undefined) updates.estimatedHours = input.estimatedHours ?? null;
    if (input.tags !== undefined) updates.tags = input.tags;
    if (input.addedReason !== undefined) updates.addedReason = input.addedReason;
    if (input.addedSource !== undefined) updates.addedSource = input.addedSource;
    if (input.progressPct !== undefined) updates.progressPct = input.progressPct;

    // Optimistic concurrency: include updatedAt in WHERE clause so the update
    // only succeeds when no other writer has changed the row since the client
    // last fetched it (ETag semantics).  Prisma throws P2025 when 0 rows match.
    const whereClause = expectedUpdatedAt
      ? { id, updatedAt: new Date(expectedUpdatedAt) }
      : { id };

    let task: Awaited<ReturnType<typeof this.prisma.task.update>>;
    try {
      task = await this.prisma.task.update({
        where: whereClause,
        data: updates,
        include: {
          primaryAssignee: { select: { id: true, name: true, avatar: true } },
          backupAssignee: { select: { id: true, name: true, avatar: true } },
          subTasks: true,
          deliverables: true,
        },
      });
    } catch (err: unknown) {
      // Prisma P2025 = "Record to update not found."
      if ((err as { code?: string }).code === "P2025") {
        // Record exists but updatedAt didn't match → concurrent modification
        throw new ConflictError(
          `任務已被其他人修改，請重新整理後再試（${id}）。`
        );
      }
      throw err;
    }

    // ── Record field-level changes for audit trail — Issue #806 (K-6) ────

    const userId = input.changedBy ?? null;
    const reason = input.changeReason;

    // Record important field changes to TaskActivity
    if (userId) {
      const fieldChanges: { action: string; detail: Record<string, unknown> }[] = [];

      if (input.status !== undefined && input.status !== existing.status) {
        fieldChanges.push({
          action: "STATUS_CHANGED",
          detail: { oldStatus: existing.status, status: input.status },
        });
      }

      if (input.priority !== undefined && input.priority !== existing.priority) {
        fieldChanges.push({
          action: "PRIORITY_CHANGED",
          detail: { oldPriority: existing.priority, newPriority: input.priority },
        });
      }

      if (input.primaryAssigneeId !== undefined && input.primaryAssigneeId !== existing.primaryAssigneeId) {
        fieldChanges.push({
          action: "ASSIGNEE_CHANGED",
          detail: {
            oldAssigneeId: existing.primaryAssigneeId,
            newAssigneeId: input.primaryAssigneeId,
            oldAssignee: existing.primaryAssigneeId ?? "未指派",
            newAssignee: input.primaryAssigneeId ?? "未指派",
          },
        });
      }

      if (input.dueDate !== undefined) {
        const oldDate = existing.dueDate?.toISOString() ?? null;
        const newDate = input.dueDate ?? null;
        if (oldDate !== newDate) {
          fieldChanges.push({
            action: "DUE_DATE_CHANGED",
            detail: { oldDueDate: oldDate, newDueDate: newDate },
          });
        }
      }

      // Write field changes to TaskActivity
      for (const change of fieldChanges) {
        await this.prisma.taskActivity.create({
          data: {
            taskId: id,
            userId,
            action: change.action,
            detail: change.detail as unknown as import("@prisma/client").Prisma.InputJsonValue,
          },
        });
      }

      // Write to activity_log (AF-1) — fire-and-forget
      if (fieldChanges.length > 0) {
        logActivity({
          userId,
          action: ActivityAction.UPDATE,
          module: ActivityModule.KANBAN,
          targetType: "Task",
          targetId: id,
          metadata: {
            changes: fieldChanges.map((c) => ({ action: c.action, ...c.detail })),
          },
        });
      }

      // Auto-detect delay/scope-change
      if (input.dueDate !== undefined) {
        const oldDueDate = existing.dueDate ?? null;
        const newDueDate = input.dueDate ? new Date(input.dueDate as string) : null;
        await this.changeTracker.detectDelay({
          taskId: id,
          oldDueDate,
          newDueDate,
          changedBy: userId,
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
          changedBy: userId,
          reason,
        });
      }
    }

    return task;
  }

  async updateTaskStatus(id: string, status: string, userId: string) {
    // Fetch old status for audit trail — Issue #806 (K-6)
    const existing = await this.prisma.task.findUnique({
      where: { id },
      select: { status: true },
    });

    if (!existing) {
      throw new NotFoundError("任務不存在");
    }

    // Banking compliance: enforce state machine transitions
    if (!isValidTaskTransition(existing.status as Parameters<typeof isValidTaskTransition>[0], status as Parameters<typeof isValidTaskTransition>[0])) {
      throw new ValidationError(
        `無法從 ${existing.status} 轉換為 ${status}，請參考狀態機定義`
      );
    }

    const task = await this.prisma.$transaction(
      async (tx) => {
        const updated = await tx.task.update({
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
            detail: {
              status,
              oldStatus: existing?.status ?? null,
            },
          },
        });

        return updated;
      },
      { timeout: 10000 }
    );

    // Fire-and-forget: write to activity_log (AF-1) — Issue #806
    logActivity({
      userId,
      action: ActivityAction.STATUS_CHANGE,
      module: ActivityModule.KANBAN,
      targetType: "Task",
      targetId: id,
      metadata: {
        oldStatus: existing?.status ?? null,
        newStatus: status,
      },
    });

    // Auto-rollup: when task transitions to DONE, recalculate upstream aggregates
    // Issue #965 — fire-and-forget to avoid blocking the response
    if (status === "DONE") {
      this.rollup.executeRollup(id).catch((err) => {
        // Log but don't fail the task update
        console.error("[auto-rollup] Failed to rollup for task", id, err);
      });
    }

    return task;
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
