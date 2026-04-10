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

  const BATCH_SIZE = 1000;

  try {
    // Hard-delete soft-deleted Tasks (cascade deletes subTasks, comments, attachments via DB)
    let tasksCount = 0;
    while (true) {
      const batch = await prisma.task.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await prisma.task.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      tasksCount += batch.length;
    }

    // Hard-delete soft-deleted TaskComments
    let commentsCount = 0;
    while (true) {
      const batch = await prisma.taskComment.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await prisma.taskComment.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      commentsCount += batch.length;
    }

    // Hard-delete soft-deleted Documents
    let documentsCount = 0;
    while (true) {
      const batch = await prisma.document.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await prisma.document.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      documentsCount += batch.length;
    }

    // Hard-delete soft-deleted KPIs (also clean up task links)
    let kpisCount = 0;
    while (true) {
      const batch = await prisma.kPI.findMany({
        where: { deletedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      const batchIds = batch.map((k) => k.id);
      await prisma.$transaction([
        prisma.kPITaskLink.deleteMany({ where: { kpiId: { in: batchIds } } }),
        prisma.kPI.deleteMany({ where: { id: { in: batchIds } } }),
      ]);
      kpisCount += batch.length;
    }

    // Hard-delete isDeleted TimeEntries older than 24h
    let timeEntriesCount = 0;
    while (true) {
      const batch = await prisma.timeEntry.findMany({
        where: { isDeleted: true, updatedAt: { lt: cutoff } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await prisma.timeEntry.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      timeEntriesCount += batch.length;
    }

    // Clean up expired refresh tokens (7-day expiry in schema)
    let refreshTokensCount = 0;
    while (true) {
      const batch = await prisma.refreshToken.findMany({
        where: { expiresAt: { lt: new Date() } },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await prisma.refreshToken.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      refreshTokensCount += batch.length;
    }

    // Clean up expired/used password reset tokens
    let resetTokensCount = 0;
    while (true) {
      const batch = await prisma.passwordResetToken.findMany({
        where: {
          OR: [
            { expiresAt: { lt: new Date() } },
            { usedAt: { not: null } },  // used tokens no longer needed
          ],
        },
        select: { id: true },
        take: BATCH_SIZE,
      });
      if (batch.length === 0) break;
      await prisma.passwordResetToken.deleteMany({ where: { id: { in: batch.map((b) => b.id) } } });
      resetTokensCount += batch.length;
    }

    const result = {
      tasks: tasksCount,
      comments: commentsCount,
      documents: documentsCount,
      kpis: kpisCount,
      timeEntries: timeEntriesCount,
      expiredRefreshTokens: refreshTokensCount,
      expiredResetTokens: resetTokensCount,
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
