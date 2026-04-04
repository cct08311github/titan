/**
 * POST /api/time-entries/settle-month — Monthly settlement (TS-25)
 *
 * Locks all APPROVED time entries for a given year/month.
 * Only ADMIN role may call this endpoint.
 * Returns 409 if the month is already fully settled.
 *
 * Body: { year: number, month: number }
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAdmin } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";
import { ConflictError } from "@/services/errors";
import { AuditService } from "@/services/audit-service";

const settleMonthSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  month: z.number().int().min(1).max(12),
});

export const POST = withAdmin(async (req: NextRequest) => {
  const session = await requireRole("ADMIN");

  const raw = await req.json();
  const { year, month } = validateBody(settleMonthSchema, raw);

  // Calculate month date range
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

  // Find all APPROVED entries in this month
  const entries = await prisma.timeEntry.findMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      approvalStatus: "APPROVED",
    },
    select: { id: true, locked: true },
  });

  // Check if already fully settled (all locked or no approved entries)
  const unlocked = entries.filter((e) => !e.locked);
  if (unlocked.length === 0) {
    throw new ConflictError("該月份已全部結算完成");
  }

  // Lock all unlocked APPROVED entries
  const result = await prisma.timeEntry.updateMany({
    where: {
      date: { gte: monthStart, lte: monthEnd },
      locked: false,
      approvalStatus: "APPROVED",
    },
    data: { locked: true },
  });

  // Audit log for compliance
  const auditService = new AuditService(prisma);
  await auditService.log({
    userId: session.user.id,
    action: "SETTLE_MONTH",
    resourceType: "TimeEntry",
    detail: `結算 ${year}/${month}，鎖定 ${result.count} 筆工時記錄`,
    ipAddress: null,
  });

  return success({
    year,
    month,
    lockedCount: result.count,
    totalEntries: entries.length,
  });
});
