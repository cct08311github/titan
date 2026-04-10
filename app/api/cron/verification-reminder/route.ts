/**
 * POST /api/cron/verification-reminder — Verification due notification (Issue #968)
 *
 * Creates VERIFICATION_DUE notifications for documents where:
 * - verifyIntervalDays is set
 * - verifiedAt + verifyIntervalDays <= now OR verifiedAt is null
 * - verifierId is assigned
 *
 * Designed to be called daily by a cron job.
 * Protected by CRON_SECRET header validation (required if env var is set).
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { verifyCronSecret } from "@/lib/cron-auth";

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  // Get all documents with verification configured
  const docs = await prisma.document.findMany({
    where: { deletedAt: null,
      verifyIntervalDays: { not: null },
      verifierId: { not: null },
    },
    select: {
      id: true,
      title: true,
      verifierId: true,
      verifiedAt: true,
      verifyIntervalDays: true,
    },
  });

  // Filter to those that are due
  const dueDocs = docs.filter((doc) => {
    if (!doc.verifiedAt) return true; // never verified
    const dueDate = new Date(doc.verifiedAt.getTime() + (doc.verifyIntervalDays ?? 0) * 86400000);
    return dueDate <= now;
  });

  // Dedup: skip if same user+doc was already notified today
  const todayStart = new Date(today + "T00:00:00.000Z");
  const existingNotifs = await prisma.notification.findMany({
    where: {
      type: "VERIFICATION_DUE",
      createdAt: { gte: todayStart },
    },
    select: { userId: true, relatedId: true },
  });
  const existingSet = new Set(existingNotifs.map((n) => `${n.userId}-${n.relatedId}`));

  const newNotifications = dueDocs
    .filter((doc) => !existingSet.has(`${doc.verifierId}-${doc.id}`))
    .map((doc) => ({
      userId: doc.verifierId!,
      type: "VERIFICATION_DUE" as const,
      title: "文件驗證到期",
      body: `「${doc.title}」需要驗證，請確認內容是否仍然正確。`,
      relatedId: doc.id,
      relatedType: "Document",
    }));

  let created = 0;
  if (newNotifications.length > 0) {
    const result = await prisma.notification.createMany({
      data: newNotifications,
    });
    created = result.count;
  }

  return success({
    checked: now.toISOString(),
    totalWithVerification: docs.length,
    dueCount: dueDocs.length,
    notificationsCreated: created,
  });
});
