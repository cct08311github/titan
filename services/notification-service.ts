import { PrismaClient } from "@prisma/client";
import { formatLocalDate } from "@/lib/utils/date";
import { publishNotifications } from "@/lib/notification-publisher";
import { queueForPush, type PushPayload } from "@/lib/push-dispatcher";

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
        isSample: false,
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
        isSample: false,
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
    const weekKey = `${formatLocalDate(weekStart)}`;

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
        isDeleted: false,
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
   * Builds daily timesheet reminders for active users who have zero
   * time entries for the given date. Intended to run at 18:00 daily (TS-29).
   *
   * Skips weekends (Saturday=6, Sunday=0).
   */
  async buildDailyTimesheetReminders(
    now: Date,
    existingKeys: Set<string>
  ): Promise<NotificationInput[]> {
    const day = now.getDay();
    // Skip weekends
    if (day === 0 || day === 6) return [];

    // Normalize to date-only (start of day)
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(now);
    todayEnd.setHours(23, 59, 59, 999);

    const todayKey = formatLocalDate(todayStart);

    // Get all active users (engineers + managers)
    const activeUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    if (activeUsers.length === 0) return [];

    // Get today's entries for all active users
    const todayEntries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: activeUsers.map((u) => u.id) },
        date: { gte: todayStart, lte: todayEnd },
        isDeleted: false,
      },
      select: { userId: true },
    });

    const usersWithEntries = new Set(todayEntries.map((e) => e.userId));

    const result: NotificationInput[] = [];
    for (const user of activeUsers) {
      if (usersWithEntries.has(user.id)) continue;

      const key = `${user.id}:TIMESHEET_REMINDER:daily:${todayKey}`;
      if (existingKeys.has(key)) continue;

      result.push({
        userId: user.id,
        type: "TIMESHEET_REMINDER",
        title: "每日工時填報提醒",
        body: `您今日（${todayKey}）尚未填報任何工時，請於下班前完成填報。`,
        relatedId: todayKey,
        relatedType: "TimeEntry",
      });
      existingKeys.add(key);
    }

    return result;
  }

  /**
   * TS-27: Detect engineers with <5h total for 3+ consecutive work days.
   * Generates TIMESHEET_REMINDER notifications sent to all MANAGERs.
   *
   * Looks back 5 work days from `now`. Skips weekends.
   * Only notifies managers (not the flagged engineer).
   */
  async buildAnomalyNotifications(
    now: Date,
    existingKeys: Set<string>
  ): Promise<NotificationInput[]> {
    const DAILY_THRESHOLD = 5;
    const CONSECUTIVE_DAYS_THRESHOLD = 3;
    const LOOKBACK_WORK_DAYS = 5;

    // Build list of work days to check (going back from today)
    const workDays: Date[] = [];
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    while (workDays.length < LOOKBACK_WORK_DAYS) {
      const day = cursor.getDay();
      if (day !== 0 && day !== 6) {
        workDays.unshift(new Date(cursor));
      }
      cursor.setDate(cursor.getDate() - 1);
    }

    if (workDays.length < CONSECUTIVE_DAYS_THRESHOLD) return [];

    const rangeStart = workDays[0];
    const rangeEnd = new Date(workDays[workDays.length - 1]);
    rangeEnd.setHours(23, 59, 59, 999);

    // Get all active engineers
    const engineers = await this.prisma.user.findMany({
      where: { isActive: true, role: "ENGINEER" },
      select: { id: true, name: true },
    });

    if (engineers.length === 0) return [];

    // Get all managers (to receive notifications)
    const managers = await this.prisma.user.findMany({
      where: { isActive: true, role: "MANAGER" },
      select: { id: true, name: true },
    });

    if (managers.length === 0) return [];

    // Get time entries in the range
    const entries = await this.prisma.timeEntry.findMany({
      where: {
        userId: { in: engineers.map((e: { id: string }) => e.id) },
        date: { gte: rangeStart, lte: rangeEnd },
        isDeleted: false,
      },
      select: { userId: true, date: true, hours: true },
    });

    // Group hours by userId and date
    const hoursByUserDate: Record<string, Record<string, number>> = {};
    for (const entry of entries) {
      const dateStr = formatLocalDate(new Date(entry.date));
      if (!hoursByUserDate[entry.userId]) hoursByUserDate[entry.userId] = {};
      hoursByUserDate[entry.userId][dateStr] =
        (hoursByUserDate[entry.userId][dateStr] ?? 0) + entry.hours;
    }

    const todayKey = formatLocalDate(now);
    const result: NotificationInput[] = [];

    for (const eng of engineers) {
      const userDays = hoursByUserDate[eng.id] ?? {};

      // Check for consecutive work days with <5h
      let consecutive = 0;
      let maxConsecutive = 0;
      for (const wd of workDays) {
        const dateStr = formatLocalDate(wd);
        const dayHours = userDays[dateStr] ?? 0;
        if (dayHours < DAILY_THRESHOLD) {
          consecutive++;
          if (consecutive > maxConsecutive) maxConsecutive = consecutive;
        } else {
          consecutive = 0;
        }
      }

      if (maxConsecutive < CONSECUTIVE_DAYS_THRESHOLD) continue;

      // Generate notification for each manager
      for (const mgr of managers) {
        const key = `${mgr.id}:TIMESHEET_REMINDER:anomaly:${eng.id}:${todayKey}`;
        if (existingKeys.has(key)) continue;

        result.push({
          userId: mgr.id,
          type: "TIMESHEET_REMINDER",
          title: `工時異常警示：${eng.name}`,
          body: `${eng.name} 已連續 ${maxConsecutive} 個工作日填報工時低於 ${DAILY_THRESHOLD} 小時，請關注。`,
          relatedId: `anomaly:${eng.id}:${todayKey}`,
          relatedType: "TimeEntry",
        });
        existingKeys.add(key);
      }
    }

    return result;
  }

  /**
   * Issue #846 (S-2): Load user notification preferences and build
   * a lookup map. Types not in the map default to enabled.
   */
  private async loadPreferences(): Promise<Map<string, boolean>> {
    const prefs = await this.prisma.notificationPreference.findMany({
      select: { userId: true, type: true, enabled: true },
    });
    const map = new Map<string, boolean>();
    for (const p of prefs) {
      map.set(`${p.userId}:${p.type}`, p.enabled);
    }
    return map;
  }

  /**
   * Filter notification payloads based on user preferences.
   * If user has explicitly disabled a notification type, skip it.
   * Defaults to enabled if no preference is set.
   */
  private filterByPreferences(
    items: NotificationInput[],
    prefMap: Map<string, boolean>
  ): NotificationInput[] {
    return items.filter((item) => {
      const key = `${item.userId}:${item.type}`;
      return prefMap.get(key) !== false; // default: enabled
    });
  }

  /**
   * Full pipeline: build all notification payloads and persist them.
   * Respects user notification preferences (Issue #846, S-2).
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
    const prefMap = await this.loadPreferences();

    const [dueSoonTaskItems, milestoneItems, overdueItems, timesheetItems] = await Promise.all([
      this.buildDueSoonTaskNotifications(now, existingKeys),
      this.buildDueSoonMilestoneNotifications(now, existingKeys),
      this.buildOverdueTaskNotifications(now, existingKeys),
      this.buildTimesheetReminders(now, existingKeys),
    ]);

    // Apply preference filtering — Issue #846 (S-2)
    const filteredDueSoon = this.filterByPreferences(dueSoonTaskItems, prefMap);
    const filteredMilestones = this.filterByPreferences(milestoneItems, prefMap);
    const filteredOverdue = this.filterByPreferences(overdueItems, prefMap);
    const filteredTimesheet = this.filterByPreferences(timesheetItems, prefMap);

    const toCreate = [...filteredDueSoon, ...filteredMilestones, ...filteredOverdue, ...filteredTimesheet];

    let created = 0;
    if (toCreate.length > 0) {
      const result = await this.prisma.notification.createMany({
        data: toCreate,
      });
      created = result.count;

      // Issue #1322 (SSE 通知即時化): 非同步推送到 Redis，不阻塞主流程
      // createMany 不回傳 id，改用查詢取得剛建立的記錄以獲取真實 id
      void this.prisma.notification
        .findMany({
          where: {
            userId: { in: [...new Set(toCreate.map((n) => n.userId))] },
            type: { in: [...new Set(toCreate.map((n) => n.type))] },
            isRead: false,
            relatedId: { in: [...new Set(toCreate.map((n) => n.relatedId))] },
          },
          select: {
            id: true,
            userId: true,
            type: true,
            title: true,
            body: true,
            isRead: true,
            createdAt: true,
            relatedId: true,
            relatedType: true,
          },
          orderBy: { createdAt: "desc" },
          take: toCreate.length,
        })
        .then(async (records) => {
          // Issue #1322: SSE push
          await publishNotifications(records);

          // Issue #1354: Mobile push — fire-and-forget, non-fatal
          const pushPayloads: PushPayload[] = records.map((n) => ({
            notificationId: n.id,
            userId: n.userId,
            title: n.title,
            body: n.body ?? "",
            data: {
              type: n.type,
              ...(n.relatedId ? { relatedId: n.relatedId } : {}),
              ...(n.relatedType ? { relatedType: n.relatedType } : {}),
            },
          }));
          await Promise.allSettled(pushPayloads.map((p) => queueForPush(p)));
        })
        .catch(() => {
          /* SSE / push 推送失敗不影響主流程 */
        });
    }

    return {
      created,
      dueSoonTasks: filteredDueSoon.length,
      dueSoonMilestones: filteredMilestones.length,
      overdueTasks: filteredOverdue.length,
      timesheetReminders: filteredTimesheet.length,
    };
  }
}
