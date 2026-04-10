/**
 * EmailNotificationService — Issue #864
 *
 * Scans for due/overdue tasks and sends email notifications.
 * Respects user NotificationPreference.emailEnabled.
 * Idempotent: uses NotificationLog to prevent duplicate sends within the same hour.
 *
 * Issue #1321: Also provides generateDailyDigest() and generateWeeklyManagerSummary().
 */

import { PrismaClient } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { logger } from "@/lib/logger";
import {
  dueSoonEmail,
  overdueEmail,
  timesheetReminderEmail,
  dailyDigestEmail,
  weeklyManagerEmail,
  type DigestItems,
  type DigestTaskItem,
  type ManagerSummary,
  type KpiBehindItem,
  type NextWeekDueItem,
} from "@/lib/email-templates";

export interface TriggerResult {
  triggered: number;
  sent: number;
  failed: number;
  skipped: number;
}

export class EmailNotificationService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Load email preferences: Map<"userId:type", boolean>
   * If no preference exists, defaults to true (enabled).
   */
  private async loadEmailPreferences(): Promise<Map<string, boolean>> {
    const prefs = await this.prisma.notificationPreference.findMany({
      select: { userId: true, type: true, emailEnabled: true },
    });
    const map = new Map<string, boolean>();
    for (const p of prefs) {
      map.set(`${p.userId}:${p.type}`, p.emailEnabled);
    }
    return map;
  }

  /**
   * Check if an email was already sent for this notification within the current hour.
   * Prevents duplicate sends on repeated trigger calls.
   */
  private async alreadySent(recipient: string, subject: string, hourKey: string): Promise<boolean> {
    const startOfHour = new Date(hourKey);
    const endOfHour = new Date(startOfHour);
    endOfHour.setHours(endOfHour.getHours() + 1);

    const existing = await this.prisma.notificationLog.findFirst({
      where: {
        recipient,
        subject,
        status: "sent",
        sentAt: { gte: startOfHour, lt: endOfHour },
      },
    });
    return !!existing;
  }

  /**
   * Log email send result.
   */
  private async logSend(params: {
    notificationId?: string;
    recipient: string;
    subject: string;
    status: "sent" | "failed";
    errorMessage?: string;
  }) {
    await this.prisma.notificationLog.create({
      data: {
        channel: "email",
        recipient: params.recipient,
        subject: params.subject,
        status: params.status,
        errorMessage: params.errorMessage,
        notificationId: params.notificationId,
      },
    });
  }

  /**
   * Trigger all scheduled email notifications.
   * Scans: TASK_DUE_SOON (24h), TASK_OVERDUE, TIMESHEET_REMINDER (Friday 16:00+).
   */
  async trigger(now: Date = new Date()): Promise<TriggerResult> {
    const prefMap = await this.loadEmailPreferences();
    const hourKey = new Date(now);
    hourKey.setMinutes(0, 0, 0);
    const hourKeyStr = hourKey.toISOString();

    let triggered = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // 1. TASK_DUE_SOON: dueDate within 24h, not DONE
    const tomorrow = new Date(now);
    tomorrow.setHours(tomorrow.getHours() + 24);

    const dueSoonTasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        dueDate: { gte: now, lte: tomorrow },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssigneeId: true,
        primaryAssignee: { select: { email: true } },
      },
    });

    for (const task of dueSoonTasks) {
      if (!task.primaryAssigneeId || !task.primaryAssignee?.email) continue;

      const prefKey = `${task.primaryAssigneeId}:TASK_DUE_SOON`;
      if (prefMap.get(prefKey) === false) {
        skipped++;
        continue;
      }

      const dueLabel = task.dueDate ? new Date(task.dueDate).toLocaleDateString("zh-TW") : "";
      const email = dueSoonEmail(task.title, task.id, dueLabel);
      triggered++;

      if (await this.alreadySent(task.primaryAssignee.email, email.subject, hourKeyStr)) {
        skipped++;
        continue;
      }

      const result = await sendEmail({
        to: task.primaryAssignee.email,
        subject: email.subject,
        html: email.html,
      });

      await this.logSend({
        recipient: task.primaryAssignee.email,
        subject: email.subject,
        status: result.success ? "sent" : "failed",
        errorMessage: result.error,
      });

      if (result.success) sent++;
      else failed++;
    }

    // 2. TASK_OVERDUE: dueDate past, not DONE
    const overdueTasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        dueDate: { lt: now },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssigneeId: true,
        primaryAssignee: { select: { email: true } },
      },
    });

    for (const task of overdueTasks) {
      if (!task.primaryAssigneeId || !task.primaryAssignee?.email) continue;

      const prefKey = `${task.primaryAssigneeId}:TASK_OVERDUE`;
      if (prefMap.get(prefKey) === false) {
        skipped++;
        continue;
      }

      const overdueDays = Math.ceil(
        (now.getTime() - new Date(task.dueDate!).getTime()) / (1000 * 60 * 60 * 24)
      );
      const email = overdueEmail(task.title, task.id, overdueDays);
      triggered++;

      if (await this.alreadySent(task.primaryAssignee.email, email.subject, hourKeyStr)) {
        skipped++;
        continue;
      }

      const result = await sendEmail({
        to: task.primaryAssignee.email,
        subject: email.subject,
        html: email.html,
      });

      await this.logSend({
        recipient: task.primaryAssignee.email,
        subject: email.subject,
        status: result.success ? "sent" : "failed",
        errorMessage: result.error,
      });

      if (result.success) sent++;
      else failed++;
    }

    // 3. TIMESHEET_REMINDER: Friday 16:00+, hours < 40
    if (now.getDay() === 5 && now.getHours() >= 16) {
      const WEEKLY_TARGET = 40;
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
      weekStart.setHours(0, 0, 0, 0);

      const engineers = await this.prisma.user.findMany({
        where: { isActive: true, role: "ENGINEER" },
        select: { id: true, email: true, name: true },
      });

      const timeEntries = await this.prisma.timeEntry.findMany({
        where: {
          userId: { in: engineers.map(e => e.id) },
          date: { gte: weekStart, lte: now },
        },
        select: { userId: true, hours: true },
      });

      const hoursByUser: Record<string, number> = {};
      for (const entry of timeEntries) {
        hoursByUser[entry.userId] = (hoursByUser[entry.userId] ?? 0) + entry.hours;
      }

      for (const eng of engineers) {
        const total = hoursByUser[eng.id] ?? 0;
        if (total >= WEEKLY_TARGET) continue;

        const prefKey = `${eng.id}:TIMESHEET_REMINDER`;
        if (prefMap.get(prefKey) === false) {
          skipped++;
          continue;
        }

        const email = timesheetReminderEmail(total, WEEKLY_TARGET);
        triggered++;

        if (await this.alreadySent(eng.email, email.subject, hourKeyStr)) {
          skipped++;
          continue;
        }

        const result = await sendEmail({
          to: eng.email,
          subject: email.subject,
          html: email.html,
        });

        await this.logSend({
          recipient: eng.email,
          subject: email.subject,
          status: result.success ? "sent" : "failed",
          errorMessage: result.error,
        });

        if (result.success) sent++;
        else failed++;
      }
    }

    return { triggered, sent, failed, skipped };
  }

  // ─── Issue #1321: Daily Personal Digest ────────────────────────────────────

  /**
   * Generate and send daily personal digest emails (08:00 daily).
   *
   * Each user receives a single email with:
   *   - Today's due tasks (≥1 triggers send)
   *   - Yesterday's new task assignments
   *   - Unread @mention/comment count (via Notification records)
   *   - Pending approval count (MANAGER/ADMIN only)
   *
   * Skips users who have disabled DAILY_DIGEST notifications.
   * Idempotent within the same hour via NotificationLog.
   */
  async generateDailyDigest(now: Date = new Date()): Promise<TriggerResult> {
    const prefMap = await this.loadEmailPreferences();
    const hourKey = new Date(now);
    hourKey.setMinutes(0, 0, 0);
    const hourKeyStr = hourKey.toISOString();

    let triggered = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Date boundaries
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // Fetch all active users
    const users = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, email: true, name: true, role: true },
    });

    // Batch queries (not per-user, to avoid N+1)

    // Tasks due today (not DONE, not sample)
    const dueTodayTasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        isSample: false, deletedAt: null,
        dueDate: { gte: todayStart, lt: todayEnd },
        primaryAssigneeId: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssigneeId: true,
      },
    });

    // Tasks assigned yesterday (not sample)
    const newAssignedTasks = await this.prisma.task.findMany({
      where: {
        isSample: false, deletedAt: null,
        createdAt: { gte: yesterdayStart, lt: todayStart },
        primaryAssigneeId: { not: null },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssigneeId: true,
      },
    });

    // Unread notifications of type TASK_COMMENTED (as a proxy for @mentions/comments)
    const unreadNotifs = await this.prisma.notification.findMany({
      where: {
        type: "TASK_COMMENTED",
        isRead: false,
      },
      select: { userId: true },
    });

    // Pending approvals (for MANAGER/ADMIN) — any PENDING ApprovalRequest
    const pendingApprovals = await this.prisma.approvalRequest.findMany({
      where: { status: "PENDING" },
      select: { approverId: true },
    });

    // Group by userId
    const dueTodayByUser = new Map<string, DigestTaskItem[]>();
    for (const t of dueTodayTasks) {
      if (!t.primaryAssigneeId) continue;
      const existing = dueTodayByUser.get(t.primaryAssigneeId) ?? [];
      existing.push({
        taskId: t.id,
        taskTitle: t.title,
        dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("zh-TW") : undefined,
      });
      dueTodayByUser.set(t.primaryAssigneeId, existing);
    }

    const newAssignByUser = new Map<string, DigestTaskItem[]>();
    for (const t of newAssignedTasks) {
      if (!t.primaryAssigneeId) continue;
      const existing = newAssignByUser.get(t.primaryAssigneeId) ?? [];
      existing.push({ taskId: t.id, taskTitle: t.title });
      newAssignByUser.set(t.primaryAssigneeId, existing);
    }

    const unreadCountByUser = new Map<string, number>();
    for (const n of unreadNotifs) {
      unreadCountByUser.set(n.userId, (unreadCountByUser.get(n.userId) ?? 0) + 1);
    }

    // Pending approvals: count per approverId (null approverId = any manager gets notified)
    const pendingCountByApprover = new Map<string, number>();
    let pendingForAnyManager = 0;
    for (const a of pendingApprovals) {
      if (a.approverId) {
        pendingCountByApprover.set(a.approverId, (pendingCountByApprover.get(a.approverId) ?? 0) + 1);
      } else {
        pendingForAnyManager++;
      }
    }

    const dateLabel = todayStart.toLocaleDateString("zh-TW");

    for (const user of users) {
      const prefKey = `${user.id}:DAILY_DIGEST`;
      if (prefMap.get(prefKey) === false) {
        skipped++;
        continue;
      }

      const dueTasks = dueTodayByUser.get(user.id) ?? [];
      const newTasks = newAssignByUser.get(user.id) ?? [];
      const mentionCount = unreadCountByUser.get(user.id) ?? 0;
      const isManager = user.role === "MANAGER" || user.role === "ADMIN";

      let pendingApprovalCount = 0;
      if (isManager) {
        pendingApprovalCount =
          (pendingCountByApprover.get(user.id) ?? 0) + pendingForAnyManager;
      }

      // Skip if nothing to report
      if (dueTasks.length === 0 && newTasks.length === 0 && mentionCount === 0 && pendingApprovalCount === 0) {
        skipped++;
        continue;
      }

      const items: DigestItems = {
        dueTodayTasks: dueTasks,
        newAssignments: newTasks,
        unreadMentionCount: mentionCount,
        pendingApprovalCount,
      };

      const email = dailyDigestEmail(user.name, items, dateLabel);
      triggered++;

      if (await this.alreadySent(user.email, email.subject, hourKeyStr)) {
        skipped++;
        continue;
      }

      const result = await sendEmail({ to: user.email, subject: email.subject, html: email.html });

      await this.logSend({
        recipient: user.email,
        subject: email.subject,
        status: result.success ? "sent" : "failed",
        errorMessage: result.error,
      });

      if (result.success) sent++;
      else failed++;
    }

    logger.info(
      { event: "daily_digest_complete", triggered, sent, failed, skipped },
      "Daily digest emails complete"
    );

    return { triggered, sent, failed, skipped };
  }

  // ─── Issue #1321: Weekly Manager Summary ───────────────────────────────────

  /**
   * Generate and send weekly manager summary emails (Friday 16:00).
   *
   * Sent to MANAGER and ADMIN users. Contains:
   *   - Team health snapshot (overdue count, flagged count)
   *   - This week's velocity (completed tasks)
   *   - KPI items behind schedule (actual < target, ACTIVE status)
   *   - Next week's due items
   *
   * Respects WEEKLY_DIGEST notification preference.
   * Idempotent within the same hour via NotificationLog.
   */
  async generateWeeklyManagerSummary(now: Date = new Date()): Promise<TriggerResult> {
    const prefMap = await this.loadEmailPreferences();
    const hourKey = new Date(now);
    hourKey.setMinutes(0, 0, 0);
    const hourKeyStr = hourKey.toISOString();

    let triggered = 0;
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    // Week boundaries
    // Current week: Monday 00:00 → Sunday 23:59
    const thisMonday = new Date(now);
    const dayOfWeek = thisMonday.getDay() === 0 ? 6 : thisMonday.getDay() - 1; // Mon=0..Sun=6
    thisMonday.setDate(thisMonday.getDate() - dayOfWeek);
    thisMonday.setHours(0, 0, 0, 0);

    const thisSunday = new Date(thisMonday);
    thisSunday.setDate(thisSunday.getDate() + 7);

    // Next week: Sun+1 (Mon) → Sun+8
    const nextMonday = new Date(thisSunday);
    const nextSunday = new Date(nextMonday);
    nextSunday.setDate(nextSunday.getDate() + 7);

    const weekLabel = `${thisMonday.toLocaleDateString("zh-TW")} ~ ${new Date(thisSunday.getTime() - 1).toLocaleDateString("zh-TW")}`;

    // --- Batch queries ---

    // Overdue count (not DONE, not sample, dueDate < now)
    const overdueCount = await this.prisma.task.count({
      where: {
        status: { notIn: ["DONE"] },
        isSample: false, deletedAt: null,
        dueDate: { lt: now },
      },
    });

    // Flagged count (managerFlagged, not DONE, not sample)
    const flaggedCount = await this.prisma.task.count({
      where: {
        status: { notIn: ["DONE"] },
        isSample: false, deletedAt: null,
        managerFlagged: true,
      },
    });

    // This week's completed tasks (status DONE, updatedAt in this week)
    const weeklyCompletedCount = await this.prisma.task.count({
      where: {
        status: "DONE",
        isSample: false, deletedAt: null,
        updatedAt: { gte: thisMonday, lt: thisSunday },
      },
    });

    // KPI items behind schedule: ACTIVE status, then filter actual < target in code
    // (Prisma does not support column-to-column comparisons in where clauses without raw SQL)
    const activeKpis = await this.prisma.kPI.findMany({
      where: { status: "ACTIVE" },
      select: {
        id: true,
        code: true,
        title: true,
        actual: true,
        target: true,
        unit: true,
      },
    });
    const kpisBehind = activeKpis.filter(k => k.actual < k.target);

    // Next week's due tasks (not DONE, not sample)
    const nextWeekTasks = await this.prisma.task.findMany({
      where: {
        status: { notIn: ["DONE"] },
        isSample: false, deletedAt: null,
        dueDate: { gte: nextMonday, lt: nextSunday },
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        primaryAssignee: { select: { name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 20, // cap to keep email readable
    });

    const kpiBehindItems: KpiBehindItem[] = kpisBehind.map(k => ({
      kpiCode: k.code,
      kpiTitle: k.title,
      actual: k.actual,
      target: k.target,
      unit: k.unit ?? "",
    }));

    const nextWeekDueItems: NextWeekDueItem[] = nextWeekTasks.map(t => ({
      taskId: t.id,
      taskTitle: t.title,
      dueDate: t.dueDate ? new Date(t.dueDate).toLocaleDateString("zh-TW") : "",
      assigneeName: t.primaryAssignee?.name ?? "未指派",
    }));

    const summary: ManagerSummary = {
      overdueCount,
      flaggedCount,
      weeklyCompletedCount,
      kpiBehindItems,
      nextWeekDueItems,
      weekLabel,
    };

    // --- Send to MANAGER + ADMIN users ---
    const managers = await this.prisma.user.findMany({
      where: { isActive: true, role: { in: ["MANAGER", "ADMIN"] } },
      select: { id: true, email: true, name: true },
    });

    for (const user of managers) {
      const prefKey = `${user.id}:WEEKLY_DIGEST`;
      if (prefMap.get(prefKey) === false) {
        skipped++;
        continue;
      }

      const email = weeklyManagerEmail(user.name, summary);
      triggered++;

      if (await this.alreadySent(user.email, email.subject, hourKeyStr)) {
        skipped++;
        continue;
      }

      const result = await sendEmail({ to: user.email, subject: email.subject, html: email.html });

      await this.logSend({
        recipient: user.email,
        subject: email.subject,
        status: result.success ? "sent" : "failed",
        errorMessage: result.error,
      });

      if (result.success) sent++;
      else failed++;
    }

    logger.info(
      { event: "weekly_manager_digest_complete", triggered, sent, failed, skipped },
      "Weekly manager digest complete"
    );

    return { triggered, sent, failed, skipped };
  }
}
