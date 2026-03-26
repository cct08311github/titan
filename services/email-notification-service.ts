/**
 * EmailNotificationService — Issue #864
 *
 * Scans for due/overdue tasks and sends email notifications.
 * Respects user NotificationPreference.emailEnabled.
 * Idempotent: uses NotificationLog to prevent duplicate sends within the same hour.
 */

import { PrismaClient } from "@prisma/client";
import { sendEmail } from "@/lib/email";
import { dueSoonEmail, overdueEmail, timesheetReminderEmail } from "@/lib/email-templates";

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
}
