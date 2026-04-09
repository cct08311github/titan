/**
 * Stale Task Detection Service — Issue #1311
 *
 * Scans for tasks that have not been updated within threshold windows
 * and creates Notification records for assignees and their managers/admins.
 *
 * Thresholds (easily overridden by T1313 config integration):
 *   REMIND    3–7 days stale
 *   WARN      7–14 days stale, or dueDate within 3 days but already stale
 *   ESCALATE  >14 days stale, or dueDate overdue by >3 days
 *
 * De-duplication: same task + level within 24 hours → skip.
 */

import type { PrismaClient } from "@prisma/client";
import { prisma as defaultPrisma } from "@/lib/prisma";
import { sanitizeMarkdown } from "@/lib/security/sanitize";
import { logger } from "@/lib/logger";

// ── Threshold constants (T1313 will replace with config reads) ──────────────
export const STALE_REMIND_DAYS = 3;
export const STALE_WARN_DAYS = 7;
export const STALE_ESCALATE_DAYS = 14;
export const STALE_DUE_WARN_DAYS = 3; // warn when dueDate ≤ 3 days away + already stale
export const STALE_DUE_ESCALATE_DAYS = 3; // escalate when overdue by >3 days
export const DEDUP_WINDOW_HOURS = 24;

export type StaleLevel = "REMIND" | "WARN" | "ESCALATE";

export interface ScanResult {
  remindCount: number;
  warnCount: number;
  escalateCount: number;
  skippedCount: number;
}

type Deps = {
  prisma: PrismaClient;
  now: Date;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(date: Date, now: Date): number {
  return (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
}

function daysUntil(date: Date, now: Date): number {
  return (date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
}

/**
 * Determine the stale level for a task.
 * Returns null if the task is not yet stale (< STALE_REMIND_DAYS).
 */
export function classifyStaleLevel(
  updatedAt: Date,
  dueDate: Date | null,
  now: Date
): StaleLevel | null {
  const staleDays = daysAgo(updatedAt, now);

  // Not yet stale
  if (staleDays < STALE_REMIND_DAYS) return null;

  // ESCALATE: >14 days stale
  if (staleDays > STALE_ESCALATE_DAYS) return "ESCALATE";

  // ESCALATE: overdue by more than STALE_DUE_ESCALATE_DAYS
  if (dueDate !== null) {
    const dueDaysLeft = daysUntil(dueDate, now);
    if (dueDaysLeft < -STALE_DUE_ESCALATE_DAYS) return "ESCALATE";

    // WARN: dueDate is coming within 3 days but task is already stale
    if (dueDaysLeft <= STALE_DUE_WARN_DAYS && staleDays >= STALE_REMIND_DAYS) return "WARN";
  }

  // WARN: 7–14 days stale
  if (staleDays >= STALE_WARN_DAYS) return "WARN";

  // REMIND: 3–7 days stale
  return "REMIND";
}

/** Build a deduplicated relatedType tag for 24-hr window checks */
function staleNotifRelatedType(level: StaleLevel): string {
  return `STALE_${level}`;
}

// ── Main export ──────────────────────────────────────────────────────────────

/**
 * Scan all non-terminal tasks for staleness and create Notification records.
 *
 * Supports dependency injection for testability; defaults to real prisma.
 */
export async function scanStaleTasks(deps?: Partial<Deps>): Promise<ScanResult> {
  const db = deps?.prisma ?? defaultPrisma;
  const now = deps?.now ?? new Date();

  const remindCutoff = new Date(now.getTime() - STALE_REMIND_DAYS * 24 * 60 * 60 * 1000);
  const dedupCutoff = new Date(now.getTime() - DEDUP_WINDOW_HOURS * 60 * 60 * 1000);

  // Query stale tasks with assignee info
  const staleTasks = await db.task.findMany({
    where: {
      updatedAt: { lt: remindCutoff },
      status: { notIn: ["DONE"] },
    },
    select: {
      id: true,
      title: true,
      updatedAt: true,
      dueDate: true,
      primaryAssignee: {
        select: {
          id: true,
          name: true,
          role: true,
        },
      },
    },
  });

  if (staleTasks.length === 0) {
    return { remindCount: 0, warnCount: 0, escalateCount: 0, skippedCount: 0 };
  }

  // Collect task IDs for dedup check
  const taskIds = staleTasks.map((t) => t.id);

  // Fetch existing stale notifications created within the last 24 hours
  const recentNotifs = await db.notification.findMany({
    where: {
      relatedId: { in: taskIds },
      relatedType: { in: ["STALE_REMIND", "STALE_WARN", "STALE_ESCALATE"] },
      createdAt: { gte: dedupCutoff },
    },
    select: { userId: true, relatedId: true, relatedType: true },
  });

  // Build dedup set: "taskId:level:userId"
  const dedupSet = new Set(
    recentNotifs.map((n) => `${n.relatedId}:${n.relatedType}:${n.userId}`)
  );

  // Fetch all MANAGERs and ADMINs for fallback/escalation
  const managers = await db.user.findMany({
    where: { role: "MANAGER", isActive: true },
    select: { id: true, role: true },
  });
  const admins = await db.user.findMany({
    where: { role: "ADMIN", isActive: true },
    select: { id: true, role: true },
  });

  const managerIds = managers.map((m) => m.id);
  const adminIds = admins.map((a) => a.id);

  // Pick fallback manager (first available)
  const fallbackManagerId = managerIds[0] ?? null;

  const notifications: {
    userId: string;
    type: "TASK_OVERDUE";
    title: string;
    body: string;
    relatedId: string;
    relatedType: string;
  }[] = [];

  let remindCount = 0;
  let warnCount = 0;
  let escalateCount = 0;
  let skippedCount = 0;

  for (const task of staleTasks) {
    const level = classifyStaleLevel(task.updatedAt, task.dueDate, now);
    if (!level) continue; // should not happen given query filter, but guard anyway

    const staleDays = Math.floor(daysAgo(task.updatedAt, now));
    const relatedType = staleNotifRelatedType(level);

    // Sanitize task title (XSS prevention)
    const safeTitle = sanitizeMarkdown(task.title);
    if (!safeTitle) {
      logger.warn({ taskId: task.id }, "[stale-task-service] task title empty after sanitize, skipping");
      continue;
    }

    // Determine recipient user IDs
    const assigneeId = task.primaryAssignee?.id ?? null;
    const recipients: string[] = [];

    if (assigneeId) recipients.push(assigneeId);

    if (level === "WARN" || level === "ESCALATE") {
      // Add manager: fallback to any MANAGER if assignee has none
      const managerId = fallbackManagerId;
      if (managerId && managerId !== assigneeId) {
        recipients.push(managerId);
      }
    }

    if (level === "ESCALATE") {
      // Add first available ADMIN
      const adminId = adminIds[0] ?? null;
      if (adminId && !recipients.includes(adminId)) {
        recipients.push(adminId);
      }
    }

    if (recipients.length === 0) {
      logger.warn({ taskId: task.id }, "[stale-task-service] no recipients for stale task");
      skippedCount++;
      continue;
    }

    // Build notification body
    const body =
      level === "REMIND"
        ? `任務「${safeTitle}」已停滯 ${staleDays} 天，請確認進度。`
        : level === "WARN"
          ? `任務「${safeTitle}」已停滯 ${staleDays} 天，需要您的注意，請盡快更新進度。`
          : `任務「${safeTitle}」已停滯 ${staleDays} 天，已升級通知，請立即處理。`;

    let addedThisTask = false;

    for (const userId of recipients) {
      const dedupKey = `${task.id}:${relatedType}:${userId}`;
      if (dedupSet.has(dedupKey)) {
        skippedCount++;
        continue;
      }

      notifications.push({
        userId,
        type: "TASK_OVERDUE",
        title:
          level === "REMIND"
            ? "任務停滯提醒"
            : level === "WARN"
              ? "任務停滯警告"
              : "任務停滯升級",
        body,
        relatedId: task.id,
        relatedType,
      });
      addedThisTask = true;
    }

    if (addedThisTask) {
      if (level === "REMIND") remindCount++;
      else if (level === "WARN") warnCount++;
      else escalateCount++;
    }
  }

  // Persist notifications in bulk
  if (notifications.length > 0) {
    await db.notification.createMany({ data: notifications });
  }

  return { remindCount, warnCount, escalateCount, skippedCount };
}
