import { PrismaClient } from "@prisma/client";

const DAYS_AHEAD = 7;

export type NotificationInput = {
  userId: string;
  type: "TASK_DUE_SOON" | "MILESTONE_DUE" | "TASK_OVERDUE" | "TIMESHEET_REMINDER";
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

  private getWeekBounds(refDate: Date): { weekStart: Date; weekEnd: Date } {
    const day = refDate.getDay();
    const diffToMon = day === 0 ? -6 : 1 - day;
    const weekStart = new Date(refDate);
    weekStart.setDate(refDate.getDate() + diffToMon);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    weekEnd.setHours(23, 59, 59, 999);
    return { weekStart, weekEnd };
  }

  /**
   * Returns existing unread notification keys (userId:type:relatedId)
   * to allow duplicate detection without re-querying inside loops.
   */
  async getExistingKeys(): Promise<Set<string>> {
    const existing = await this.prisma.notification.findMany({
      where: {
        isRead: false,
        type: { in: ["TASK_DUE_SOON", "MILESTONE_DUE", "TASK_OVERDUE", "TIMESHEET_REMINDER"] },
      },
      select: { userId: true, type: true, relatedId: true },
    });
    return new Set(existing.map((n) => `${n.userId}:${n.type}:${n.relatedId}`));
  }

  /**
   * Builds notification payloads for tasks due within DAYS_AHEAD days.
   * Only notifies active (non-suspended) users.
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

    // Collect all candidate user IDs and filter to active users only
    const candidateIds = new Set(
      tasks
        .flatMap((t) => [t.primaryAssigneeId, t.backupAssigneeId])
        .filter(Boolean) as string[]
    );
    const activeUsers =
      candidateIds.size > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: [...candidateIds] }, isActive: true },
            select: { id: true },
          })
        : [];
    const activeUserIds = new Set(activeUsers.map((u) => u.id));

    const result: NotificationInput[] = [];
    for (const task of tasks) {
      const userIds = [task.primaryAssigneeId, task.backupAssigneeId].filter(
        (id): id is string =>
          id !== null && id !== undefined && activeUserIds.has(id)
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
   * Notifies all active (non-suspended) users in the system.
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
      this.prisma.user.findMany({
        where: { isActive: true },
        select: { id: true },
      }),
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
   * Only notifies active (non-suspended) users.
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

    // Collect all candidate user IDs and filter to active users only
    const candidateIds = new Set(
      tasks
        .flatMap((t) => [t.primaryAssigneeId, t.backupAssigneeId])
        .filter(Boolean) as string[]
    );
    const activeUsers =
      candidateIds.size > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: [...candidateIds] }, isActive: true },
            select: { id: true },
          })
        : [];
    const activeUserIds = new Set(activeUsers.map((u) => u.id));

    const result: NotificationInput[] = [];
    for (const task of tasks) {
      const userIds = [task.primaryAssigneeId, task.backupAssigneeId].filter(
        (id): id is string =>
          id !== null && id !== undefined && activeUserIds.has(id)
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
   * Builds notification payloads for engineers with < 35 hours logged this week.
   * Intended to run every Friday at 16:00 via cron, but can be triggered anytime.
   * Only generates reminders on Fridays (day === 5) to avoid noise.
   */
  async buildTimesheetReminders(
    now: Date,
    existingKeys: Set<string>
  ): Promise<NotificationInput[]> {
    const WEEKLY_THRESHOLD = 35;

    // Only generate on Fridays
    if (now.getDay() !== 5) return [];

    const { weekStart, weekEnd } = this.getWeekBounds(now);
    const weekKey = `${weekStart.toISOString().slice(0, 10)}`;

    // Get all active engineers
    const engineers = await this.prisma.user.findMany({
      where: { isActive: true, role: "ENGINEER" },
      select: { id: true, name: true },
    });

    if (engineers.length === 0) return [];

    // Get total hours per user for this week
    const timeEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: engineers.map((e) => e.id) },
        date: { gte: weekStart, lte: weekEnd },
      },
      select: { userId: true, hours: true },
    });

    const hoursByUser = timeEntries.reduce((acc, e) => {
      acc[e.userId] = (acc[e.userId] ?? 0) + e.hours;
      return acc;
    }, {} as Record<string, number>);

    const result: NotificationInput[] = [];
    for (const eng of engineers) {
      const totalHours = hoursByUser[eng.id] ?? 0;
      if (totalHours >= WEEKLY_THRESHOLD) continue;

      const key = `${eng.id}:TIMESHEET_REMINDER:${weekKey}`;
      if (existingKeys.has(key)) continue;

      result.push({
        userId: eng.id,
        type: "TIMESHEET_REMINDER",
        title: "工時填報提醒",
        body: `本週已填報 ${totalHours.toFixed(1)} 小時，低於 ${WEEKLY_THRESHOLD} 小時門檻，請於下班前補齊。`,
        relatedId: weekKey,
        relatedType: "TimeEntry",
      });
      existingKeys.add(key);
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
    timesheetReminders: number;
  }> {
    const existingKeys = await this.getExistingKeys();

    const [dueSoonTaskItems, milestoneItems, overdueItems, timesheetItems] = await Promise.all([
      this.buildDueSoonTaskNotifications(now, existingKeys),
      this.buildDueSoonMilestoneNotifications(now, existingKeys),
      this.buildOverdueTaskNotifications(now, existingKeys),
      this.buildTimesheetReminders(now, existingKeys),
    ]);

    const toCreate = [...dueSoonTaskItems, ...milestoneItems, ...overdueItems, ...timesheetItems];

    let created = 0;
    if (toCreate.length > 0) {
      const result = await this.prisma.notification.createMany({
        data: toCreate,
      });
      created = result.count;
    }

    return {
      created,
      dueSoonTasks: dueSoonTaskItems.length,
      dueSoonMilestones: milestoneItems.length,
      overdueTasks: overdueItems.length,
      timesheetReminders: timesheetItems.length,
    };
  }
}
