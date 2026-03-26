/**
 * PUT / DELETE /api/time-entries/[id]
 *
 * Updated to include explicit audit trail logging (TS-08).
 * Every update/delete records the action, old values, and who did it.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateTimeEntrySchema } from "@/validators/time-entry-validators";
import { validateDailyLimit } from "@/validators/shared/time-entry";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const PUT = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();

  const callerId = session.user.id;
  const { id } = await context.params;

  // Fetch first to check ownership — single query, no N+1.
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

  const callerRole = session.user.role ?? "ENGINEER";

  // IDOR: all roles (including MANAGER) may only write their own entries.
  // ADMIN can edit any entry (including locked ones).
  if (existing.userId !== callerId && callerRole !== "ADMIN") {
    throw new ForbiddenError("只能修改自己的時間記錄");
  }

  // T-6: Auto-lock check — entries created more than 7 days ago are locked
  const createdAt = new Date(existing.createdAt);
  const daysSinceCreation = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24);
  const isAutoLocked = daysSinceCreation > 7;
  const isManuallyLocked = (existing as Record<string, unknown>).locked === true;

  // Only ADMIN can bypass lock
  if ((isAutoLocked || isManuallyLocked) && callerRole !== "ADMIN") {
    throw new ForbiddenError("此工時記錄已鎖定（超過 7 天），無法修改。請向管理員申請解鎖。");
  }

  const raw = await req.json();
  const { taskId, date, hours, category, description } = validateBody(updateTimeEntrySchema, raw);

  // T-1: Enforce daily 24hr limit when hours change
  if (hours !== undefined) {
    const targetDate = date ? new Date(date) : existing.date;
    const dayEntries = await prisma.timeEntry.findMany({
      where: {
        userId: callerId,
        date: targetDate,
        id: { not: id }, // exclude current entry
      },
      select: { hours: true },
    });
    const dayTotal = dayEntries.reduce((sum, e) => sum + e.hours, 0);
    const limitError = validateDailyLimit(dayTotal, hours);
    if (limitError) {
      throw new ValidationError(limitError);
    }
  }

  const updates: Record<string, unknown> = {};
  if (taskId !== undefined) updates.taskId = taskId || null;
  if (date !== undefined) updates.date = new Date(date);
  if (hours !== undefined) updates.hours = hours;
  if (category !== undefined) updates.category = category as TimeCategory;
  if (description !== undefined) updates.description = description || null;

  // Phase 2: Auto-reset REJECTED → PENDING on edit
  if ((existing as Record<string, unknown>).approvalStatus === "REJECTED") {
    updates.approvalStatus = "PENDING";
  }

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: updates,
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
  });

  // TS-08: Explicit audit trail for time entry updates
  await prisma.auditLog.create({
    data: {
      userId: callerId,
      action: "UPDATE_TIME_ENTRY",
      resourceType: "TimeEntry",
      resourceId: id,
      detail: JSON.stringify({
        oldValues: {
          hours: existing.hours,
          category: existing.category,
          description: existing.description,
          date: existing.date,
          taskId: existing.taskId,
        },
        newValues: updates,
      }),
    },
  });

  return success(entry);
});

export const DELETE = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();

  const callerId = session.user.id;
  const { id } = await context.params;

  // Fetch first to check ownership — single query, no N+1.
  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

  const deleterRole = session.user.role ?? "ENGINEER";

  // IDOR: all roles (including MANAGER) may only delete their own entries.
  // ADMIN can delete any entry.
  if (existing.userId !== callerId && deleterRole !== "ADMIN") {
    throw new ForbiddenError("只能刪除自己的時間記錄");
  }

  // T-6: Auto-lock check + manual lock — only ADMIN bypasses
  const delCreatedAt = new Date(existing.createdAt);
  const delDaysSince = (Date.now() - delCreatedAt.getTime()) / (1000 * 60 * 60 * 24);
  const delIsLocked = delDaysSince > 7 || (existing as Record<string, unknown>).locked === true;

  if (delIsLocked && deleterRole !== "ADMIN") {
    throw new ForbiddenError("此工時記錄已鎖定（超過 7 天），無法刪除。請向管理員申請解鎖。");
  }

  await prisma.timeEntry.delete({ where: { id } });

  // TS-08: Explicit audit trail for time entry deletions
  await prisma.auditLog.create({
    data: {
      userId: callerId,
      action: "DELETE_TIME_ENTRY",
      resourceType: "TimeEntry",
      resourceId: id,
      detail: JSON.stringify({
        deletedEntry: {
          hours: existing.hours,
          category: existing.category,
          description: existing.description,
          date: existing.date,
          taskId: existing.taskId,
        },
      }),
    },
  });

  return success({ success: true });
});
