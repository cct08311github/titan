/**
 * POST /api/time-entries/confirm-suggestions — Issue #963
 *
 * Batch confirm time entry suggestions. Creates time entries for all
 * confirmed suggestions in a single transaction.
 *
 * Body: { suggestions: Array<{ taskId, hours, date, category }> }
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";
import { sanitizeHtml } from "@/lib/security/sanitize";

interface ConfirmItem {
  taskId: string;
  hours: number;
  date: string;
  category?: string;
  description?: string;
}

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const body = await req.json();
  const items: ConfirmItem[] = body?.suggestions;

  if (!Array.isArray(items) || items.length === 0) {
    throw new ValidationError("至少需要一筆工時建議");
  }

  // Validate all items
  for (const item of items) {
    if (!item.taskId || typeof item.taskId !== "string") {
      throw new ValidationError("每筆建議必須包含 taskId");
    }
    if (typeof item.hours !== "number" || item.hours <= 0 || item.hours > 24) {
      throw new ValidationError(`工時必須在 0.01 ~ 24 之間（taskId: ${item.taskId}）`);
    }
    if (!item.date || !/^\d{4}-\d{2}-\d{2}$/.test(item.date)) {
      throw new ValidationError(`日期格式錯誤（taskId: ${item.taskId}）`);
    }
  }

  // Create all entries in a transaction
  const created = await prisma.$transaction(
    items.map((item) =>
      prisma.timeEntry.create({
        data: {
          userId,
          taskId: item.taskId,
          date: new Date(item.date),
          hours: Math.round(item.hours * 100) / 100, // 2 decimal precision
          category: (item.category as TimeCategory) ?? "PLANNED_TASK",
          description: item.description
            ? sanitizeHtml(item.description.slice(0, 500)) || "自動建議確認"
            : "自動建議確認",
        },
      })
    )
  );

  return success({ confirmed: created.length, entries: created });
});
