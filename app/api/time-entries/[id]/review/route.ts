/**
 * PATCH /api/time-entries/[id]/review — Manager review/lock (TS-24)
 *
 * Only MANAGER role can lock or unlock a time entry.
 * Locked entries cannot be modified or deleted by the owner.
 * All lock/unlock actions are recorded in AuditLog.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";

const reviewSchema = z.object({
  locked: z.boolean(),
});

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;

  const existing = await prisma.timeEntry.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

  const raw = await req.json();
  const { locked } = validateBody(reviewSchema, raw);

  const updated = await prisma.timeEntry.update({
    where: { id },
    data: { locked },
    include: {
      task: { select: { id: true, title: true, category: true } },
      user: { select: { id: true, name: true } },
    },
  });

  // Audit trail for review action
  await prisma.auditLog.create({
    data: {
      userId: session.user.id,
      action: locked ? "LOCK_TIME_ENTRY" : "UNLOCK_TIME_ENTRY",
      resourceType: "TimeEntry",
      resourceId: id,
      detail: JSON.stringify({
        entryOwnerId: existing.userId,
        previousLocked: existing.locked ?? false,
        newLocked: locked,
      }),
    },
  });

  return success(updated);
});
