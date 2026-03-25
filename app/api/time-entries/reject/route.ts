/**
 * POST /api/time-entries/reject
 *
 * Batch reject time entries. MANAGER only — Issue #851 (Phase 2).
 *
 * - reason is required (zod validation)
 * - Sets locked=false, approvalStatus=REJECTED
 * - Creates TimesheetApproval records
 * - Creates Notification for affected users
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const rejectSchema = z.object({
  entryIds: z.array(z.string()).min(1, "至少需選擇一筆工時記錄"),
  reason: z.string().min(1, "駁回理由為必填"),
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireRole("MANAGER");
  const reviewerId = session.user.id;

  const raw = await req.json();
  const { entryIds, reason } = validateBody(rejectSchema, raw);

  // Fetch all target entries
  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds } },
  });

  // Filter: only PENDING/APPROVED entries can be rejected
  const eligible = entries.filter(
    (e) =>
      (e as Record<string, unknown>).approvalStatus === "PENDING" ||
      (e as Record<string, unknown>).approvalStatus === "APPROVED"
  );

  if (eligible.length === 0) {
    return error("NoEligibleEntries", "沒有符合駁回條件的工時記錄", 400);
  }

  const eligibleIds = eligible.map((e) => e.id);

  // Collect unique affected user IDs for notifications
  const affectedUserIds = [...new Set(eligible.map((e) => e.userId))];

  // Transaction: update entries + create approval records + notifications + audit log
  await prisma.$transaction(async (tx) => {
    // Batch update entries
    await tx.timeEntry.updateMany({
      where: { id: { in: eligibleIds } },
      data: {
        locked: false,
        approvalStatus: "REJECTED",
      },
    });

    // Create approval records
    await tx.timesheetApproval.createMany({
      data: eligibleIds.map((entryId) => ({
        timeEntryId: entryId,
        reviewerId,
        status: "REJECTED" as const,
        reason,
      })),
    });

    // Create notifications for affected users
    await tx.notification.createMany({
      data: affectedUserIds.map((userId) => ({
        userId,
        type: "TIMESHEET_REJECTED" as const,
        title: "工時被駁回",
        body: `主管駁回了您的工時記錄，理由：${reason}`,
        relatedType: "TimeEntry",
      })),
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: reviewerId,
        action: "BATCH_REJECT_TIME_ENTRIES",
        resourceType: "TimeEntry",
        detail: JSON.stringify({
          entryIds: eligibleIds,
          count: eligibleIds.length,
          reason,
          affectedUserIds,
        }),
      },
    });
  });

  return success({
    rejected: eligibleIds.length,
    skipped: entries.length - eligible.length,
    entryIds: eligibleIds,
  });
});
