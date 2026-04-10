/**
 * POST /api/cron/cleanup-deleted — Hard-delete soft-deleted records (Issue #1324)
 *
 * Permanently removes:
 * - Task, TaskComment, Document, KPI where deletedAt < now - 24h
 * - TimeEntry where isDeleted = true AND updatedAt < now - 24h
 *
 * Protected by CRON_SECRET header.
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifyCronSecret } from "@/lib/cron-auth";
import { logger } from "@/lib/logger";

const HARD_DELETE_AFTER_MS = 24 * 60 * 60 * 1000; // 24 hours

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  const cutoff = new Date(Date.now() - HARD_DELETE_AFTER_MS);

  try {
    // Hard-delete soft-deleted Tasks (cascade deletes subTasks, comments, attachments via DB)
    const deletedTasks = await prisma.task.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });

    // Hard-delete soft-deleted TaskComments
    const deletedComments = await prisma.taskComment.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });

    // Hard-delete soft-deleted Documents
    const deletedDocuments = await prisma.document.deleteMany({
      where: { deletedAt: { lt: cutoff } },
    });

    // Hard-delete soft-deleted KPIs (also clean up task links)
    const expiredKpis = await prisma.kPI.findMany({
      where: { deletedAt: { lt: cutoff } },
      select: { id: true },
    });
    const expiredKpiIds = expiredKpis.map((k) => k.id);
    let deletedKpis = { count: 0 };
    if (expiredKpiIds.length > 0) {
      await prisma.kPITaskLink.deleteMany({ where: { kpiId: { in: expiredKpiIds } } });
      deletedKpis = await prisma.kPI.deleteMany({
        where: { id: { in: expiredKpiIds } },
      });
    }

    // Hard-delete isDeleted TimeEntries older than 24h
    const deletedTimeEntries = await prisma.timeEntry.deleteMany({
      where: {
        isDeleted: true,
        updatedAt: { lt: cutoff },
      },
    });

    // Clean up expired refresh tokens (7-day expiry in schema)
    const expiredRefreshTokens = await prisma.refreshToken.deleteMany({
      where: { expiresAt: { lt: new Date() } },
    });

    // Clean up expired/used password reset tokens
    const expiredResetTokens = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { usedAt: { not: null } },  // used tokens no longer needed
        ],
      },
    });

    const result = {
      tasks: deletedTasks.count,
      comments: deletedComments.count,
      documents: deletedDocuments.count,
      kpis: deletedKpis.count,
      timeEntries: deletedTimeEntries.count,
      expiredRefreshTokens: expiredRefreshTokens.count,
      expiredResetTokens: expiredResetTokens.count,
      cleanedAt: new Date().toISOString(),
      cutoff: cutoff.toISOString(),
    };

    logger.info(result, "[cleanup-deleted] hard-delete sweep completed");
    return success(result);
  } catch (err) {
    logger.error({ err }, "[cleanup-deleted] sweep failed");
    return error("ServerError", "Cleanup sweep failed", 500);
  }
});
