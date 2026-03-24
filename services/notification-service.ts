import { PrismaClient } from "@prisma/client";

const DAYS_AHEAD = 7;

export type NotificationInput = {
  userId: string;
  type: "TASK_DUE_SOON" | "MILESTONE_DUE" | "TASK_OVERDUE";
  title: string;
  body: string;
  relatedId: string;
  relatedType: string;
};

export class NotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  private addDays(date: Date, days: number): Date {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
  }

  /**
   * Returns existing unread notification keys (userId:type:relatedId)
   * to allow duplicate detection without re-querying inside loops.
   */
  async getExistingKeys(): Promise<Set<string>> {
    const existing = await this.prisma.notification.findMany({
      where: {
        isRead: false,
        type: { in: ["TASK_DUE_SOON", "MILESTONE_DUE", "TASK_OVERDUE"] },
      },
      select: { userId: true, type: true, relatedId: true },
    });
    return new Set(existing.map((n) => `${n.userId}:${n.type}:${n.relatedId}`));
  }

  /**
   * Builds notification payloads for tasks due within DAYS_AHEAD days.
   */
  async buildDueSoonTaskNotifications(
    now: Date,
    existingKeys: Set<string>
  ): Promise<NotificationInput[]> {
    const cutoff = this.addDays(now, DAYS_AHEAD);

    const tasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        dueDate: { gte: now, lte: cutoff },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssigneeId: true,
        backupAssigneeId: true,
      },
    });

    const result: NotificationInput[] = [];
    for (const task of tasks) {
      const userIds = [task.primaryAssigneeId, task.backupAssigneeId].filter(
        (id): id is string => id !== null && id !== undefined
      );
      const dueLabel = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString("zh-TW")
        : "";

      for (const userId of userIds) {
        const key = `${userId}:TASK_DUE_SOON:${task.id}`;
        if (!existingKeys.has(key)) {
          result.push({
            userId,
            type: "TASK_DUE_SOON",
            title: `任務即將到期：${task.title}`,
            body: `到期日：${dueLabel}`,
            relatedId: task.id,
            relatedType: "Task",
          });
          existingKeys.add(key);
        }
      }
    }
    return result;
  }

  /**
   * Builds notification payloads for milestones due within DAYS_AHEAD days.
   * Notifies all users in the system.
   */
  async buildDueSoonMilestoneNotifications(
    now: Date,
    existingKeys: Set<string>
  ): Promise<NotificationInput[]> {
    const cutoff = this.addDays(now, DAYS_AHEAD);

    const [milestones, allUsers] = await Promise.all([
      this.prisma.milestone.findMany({
        where: {
          status: { notIn: ["COMPLETED", "CANCELLED"] },
          plannedEnd: { gte: now, lte: cutoff },
        },
        select: { id: true, title: true, plannedEnd: true },
      }),
      this.prisma.user.findMany({ select: { id: true } }),
    ]);

    const result: NotificationInput[] = [];
    for (const ms of milestones) {
      const dueLabel = new Date(ms.plannedEnd).toLocaleDateString("zh-TW");
      for (const user of allUsers) {
        const key = `${user.id}:MILESTONE_DUE:${ms.id}`;
        if (!existingKeys.has(key)) {
          result.push({
            userId: user.id,
            type: "MILESTONE_DUE",
            title: `里程碑即將到期：${ms.title}`,
            body: `計畫結束日：${dueLabel}`,
            relatedId: ms.id,
            relatedType: "Milestone",
          });
          existingKeys.add(key);
        }
      }
    }
    return result;
  }

  /**
   * Builds notification payloads for overdue tasks (past due date, not done).
   */
  async buildOverdueTaskNotifications(
    now: Date,
    existingKeys: Set<string>
  ): Promise<NotificationInput[]> {
    const tasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssigneeId: true,
        backupAssigneeId: true,
      },
    });

    const result: NotificationInput[] = [];
    for (const task of tasks) {
      const userIds = [task.primaryAssigneeId, task.backupAssigneeId].filter(
        (id): id is string => id !== null && id !== undefined
      );
      const dueLabel = task.dueDate
        ? new Date(task.dueDate).toLocaleDateString("zh-TW")
        : "";

      for (const userId of userIds) {
        const key = `${userId}:TASK_OVERDUE:${task.id}`;
        if (!existingKeys.has(key)) {
          result.push({
            userId,
            type: "TASK_OVERDUE",
            title: `任務已逾期：${task.title}`,
            body: `原定到期日：${dueLabel}`,
            relatedId: task.id,
            relatedType: "Task",
          });
          existingKeys.add(key);
        }
      }
    }
    return result;
  }

  /**
   * Full pipeline: build all notification payloads and persist them.
   * Returns counts for observability.
   */
  async generateAll(now: Date = new Date()): Promise<{
    created: number;
    dueSoonTasks: number;
    dueSoonMilestones: number;
    overdueTasks: number;
  }> {
    const existingKeys = await this.getExistingKeys();

    const [dueSoonTaskItems, milestoneItems, overdueItems] = await Promise.all([
      this.buildDueSoonTaskNotifications(now, existingKeys),
      this.buildDueSoonMilestoneNotifications(now, existingKeys),
      this.buildOverdueTaskNotifications(now, existingKeys),
    ]);

    const toCreate = [...dueSoonTaskItems, ...milestoneItems, ...overdueItems];

    let created = 0;
    if (toCreate.length > 0) {
      const result = await this.prisma.notification.createMany({ data: toCreate });
      created = result.count;
    }

    return {
      created,
      dueSoonTasks: dueSoonTaskItems.length,
      dueSoonMilestones: milestoneItems.length,
      overdueTasks: overdueItems.length,
    };
  }
}
