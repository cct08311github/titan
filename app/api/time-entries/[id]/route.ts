/**
 * PUT / DELETE /api/time-entries/[id]
 *
 * Updated to include explicit audit trail logging (TS-08).
 * Every update/delete records the action, old values, and who did it.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { ForbiddenError, NotFoundError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateTimeEntrySchema } from "@/validators/time-entry-validators";
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

  // IDOR: all roles (including MANAGER) may only write their own entries.
  if (existing.userId !== callerId) {
    throw new ForbiddenError("只能修改自己的時間記錄");
  }

  // TS-24: Locked entries cannot be modified
  if ((existing as Record<string, unknown>).locked) {
    throw new ForbiddenError("此工時記錄已被主管鎖定，無法修改");
  }

  const raw = await req.json();
  const { taskId, date, hours, category, description } = validateBody(updateTimeEntrySchema, raw);

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

  // IDOR: all roles (including MANAGER) may only delete their own entries.
  if (existing.userId !== callerId) {
    throw new ForbiddenError("只能刪除自己的時間記錄");
  }

  // TS-24: Locked entries cannot be deleted
  if ((existing as Record<string, unknown>).locked) {
    throw new ForbiddenError("此工時記錄已被主管鎖定，無法刪除");
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
