/**
 * POST /api/time-entries/approve
 *
 * Batch approve time entries. MANAGER only — Issue #851 (Phase 2).
 *
 * P0 checks:
 *   - No self-approval (reviewer === entry.userId → 403)
 *   - Exclude isRunning entries
 *   - Only PENDING/REJECTED → APPROVED
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { ForbiddenError, ConflictError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";

const approveSchema = z.object({
  entryIds: z.array(z.string()).min(1, "至少需選擇一筆工時記錄").max(500, "單次最多核准 500 筆工時記錄"),
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireRole("MANAGER");
  const reviewerId = session.user.id;

  const raw = await req.json();
  const { entryIds } = validateBody(approveSchema, raw);

  // Fetch all target entries
  const entries = await prisma.timeEntry.findMany({
    where: { id: { in: entryIds } },
  });

  // P0: Block self-approval
  const selfEntries = entries.filter((e) => e.userId === reviewerId);
  if (selfEntries.length > 0) {
    throw new ForbiddenError("不可審核自己的工時記錄");
  }

  // Filter: exclude isRunning, only PENDING/REJECTED
  const eligible = entries.filter(
    (e) =>
      !e.isRunning &&
      ((e as Record<string, unknown>).approvalStatus === "PENDING" ||
        (e as Record<string, unknown>).approvalStatus === "REJECTED")
  );

  if (eligible.length === 0) {
    return error("NoEligibleEntries", "沒有符合核准條件的工時記錄", 400);
  }

  const eligibleIds = eligible.map((e) => e.id);

  // Transaction: update entries + create approval records + audit log
  await prisma.$transaction(async (tx) => {
    // Double-approve fix: add approvalStatus condition so concurrent approve
    // requests only update entries that are still PENDING/REJECTED.
    const result = await tx.timeEntry.updateMany({
      where: {
        id: { in: eligibleIds },
        approvalStatus: { in: ["PENDING", "REJECTED"] },
      },
      data: {
        locked: true,
        approvalStatus: "APPROVED",
      },
    });

    // If count mismatches, some entries were already approved by a concurrent request.
    if (result.count !== eligibleIds.length) {
      throw new ConflictError("部分工時記錄已被其他請求審核，請重新整理後再試");
    }

    // Create approval records
    await tx.timesheetApproval.createMany({
      data: eligibleIds.map((entryId) => ({
        timeEntryId: entryId,
        reviewerId,
        status: "APPROVED" as const,
      })),
    });

    // Audit log
    await tx.auditLog.create({
      data: {
        userId: reviewerId,
        action: "BATCH_APPROVE_TIME_ENTRIES",
        resourceType: "TimeEntry",
        detail: JSON.stringify({
          entryIds: eligibleIds,
          count: eligibleIds.length,
        }),
      },
    });
  });

  return success({
    approved: eligibleIds.length,
    skipped: entries.length - eligible.length,
    entryIds: eligibleIds,
  });
});
