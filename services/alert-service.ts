/**
 * Alert Service — Issue #986
 *
 * Generates active alerts based on system state:
 * - Plan behind schedule
 * - KPI critical (< 60%)
 * - Tasks overdue > 3 days
 * - Timesheet not submitted this week
 * - Document verification expired
 */
import { PrismaClient } from "@prisma/client";

export type AlertLevel = "CRITICAL" | "WARNING";
export type AlertCategory =
  | "plan_behind"
  | "kpi_critical"
  | "overdue"
  | "timesheet_missing"
  | "verification_expired";

export interface ActiveAlert {
  id: string;
  level: AlertLevel;
  category: AlertCategory;
  message: string;
  link: string;
  createdAt: Date;
}

export class AlertService {
  constructor(private readonly prisma: PrismaClient) {}

  async getActiveAlerts(): Promise<ActiveAlert[]> {
    const alerts: ActiveAlert[] = [];
    const now = new Date();

    // 1. Plans behind schedule
    const plans = await this.prisma.annualPlan.findMany({
      where: { archivedAt: null, year: now.getFullYear() },
      select: { id: true, title: true, progressPct: true, createdAt: true },
    });

    const monthProgress = ((now.getMonth() + 1) / 12) * 100;
    for (const plan of plans) {
      if (plan.progressPct < monthProgress * 0.7) {
        alerts.push({
          id: `plan-behind-${plan.id}`,
          level: "WARNING",
          category: "plan_behind",
          message: `計畫「${plan.title}」進度落後 (${Math.round(plan.progressPct)}% vs 預期 ${Math.round(monthProgress)}%)`,
          link: `/plans`,
          createdAt: now,
        });
      }
    }

    // 2. KPI critical (< 60% achievement)
    const kpis = await this.prisma.kPI.findMany({
      where: { deletedAt: null, year: now.getFullYear(), status: "ACTIVE" },
      select: { id: true, title: true, target: true, actual: true },
    });

    for (const kpi of kpis) {
      const achievement = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0;
      if (achievement < 60) {
        alerts.push({
          id: `kpi-critical-${kpi.id}`,
          level: "CRITICAL",
          category: "kpi_critical",
          message: `KPI「${kpi.title}」達成率僅 ${Math.round(achievement)}%，低於 60% 門檻`,
          link: `/kpi`,
          createdAt: now,
        });
      }
    }

    // 3. Tasks overdue > 3 days
    const threeDaysAgo = new Date(now);
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const overdueTasks = await this.prisma.task.findMany({
      where: { deletedAt: null,
        isSample: false,
        status: { not: "DONE" },
        dueDate: { lt: threeDaysAgo },
      },
      select: { id: true },
    });

    if (overdueTasks.length > 0) {
      alerts.push({
        id: `overdue-${now.toISOString().slice(0, 10)}`,
        level: "CRITICAL",
        category: "overdue",
        message: `${overdueTasks.length} 個任務逾期超過 3 天`,
        link: `/kanban`,
        createdAt: now,
      });
    }

    // 4. Timesheet not submitted this week
    const dayOfWeek = now.getDay();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    weekStart.setHours(0, 0, 0, 0);

    const activeUsers = await this.prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
    });

    const weekEntries = await this.prisma.timeEntry.findMany({
      where: { date: { gte: weekStart, lte: now }, isDeleted: false },
      select: { userId: true },
    });

    const usersWithEntries = new Set(weekEntries.map((e) => e.userId));
    const missingUsers = activeUsers.filter((u) => !usersWithEntries.has(u.id));

    if (missingUsers.length > 0 && dayOfWeek >= 3) {
      // Only alert after Wednesday
      alerts.push({
        id: `timesheet-missing-${now.toISOString().slice(0, 10)}`,
        level: "WARNING",
        category: "timesheet_missing",
        message: `${missingUsers.length} 位成員本週尚未提交工時`,
        link: `/timesheet`,
        createdAt: now,
      });
    }

    // 5. Document verification expired
    const expiredDocs = await this.prisma.document.findMany({
      where: { deletedAt: null,
        status: "PUBLISHED",
        verifyIntervalDays: { not: null },
        verifiedAt: { not: null },
      },
      select: { id: true, title: true, verifiedAt: true, verifyIntervalDays: true },
    });

    for (const doc of expiredDocs) {
      if (doc.verifiedAt && doc.verifyIntervalDays) {
        const expiryDate = new Date(doc.verifiedAt);
        expiryDate.setDate(expiryDate.getDate() + doc.verifyIntervalDays);
        if (expiryDate < now) {
          alerts.push({
            id: `verification-expired-${doc.id}`,
            level: "WARNING",
            category: "verification_expired",
            message: `文件「${doc.title}」驗證已過期`,
            link: `/knowledge`,
            createdAt: now,
          });
        }
      }
    }

    // Sort: CRITICAL first, then by createdAt
    return alerts.sort((a, b) => {
      if (a.level === "CRITICAL" && b.level !== "CRITICAL") return -1;
      if (a.level !== "CRITICAL" && b.level === "CRITICAL") return 1;
      return 0;
    });
  }
}
