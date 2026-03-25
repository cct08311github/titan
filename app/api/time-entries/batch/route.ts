/**
 * POST /api/time-entries/batch — Batch create time entries (TS-06)
 *
 * Creates multiple time entries in a single transactional request.
 * Validates all entries upfront; rejects if any overlap with existing entries
 * (same date + same taskId for the same user).
 *
 * Limits: max 50 entries per request.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { withAuth } from "@/lib/auth-middleware";
import { formatLocalDate } from "@/lib/utils/date";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success, error } from "@/lib/api-response";
import { TimeCategoryEnum } from "@/validators/shared/enums";
import { ValidationError } from "@/services/errors";

const batchEntrySchema = z.object({
  date: z.string().date(),
  hours: z.number().min(0).max(24),
  taskId: z.string().optional(),
  category: TimeCategoryEnum.optional().default("PLANNED_TASK"),
  description: z.string().optional(),
});

const batchCreateSchema = z.object({
  entries: z
    .array(batchEntrySchema)
    .min(1, "至少需要一筆工時記錄")
    .max(50, "單次最多 50 筆工時記錄"),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const raw = await req.json();
  const { entries } = validateBody(batchCreateSchema, raw);

  // Use a transaction to ensure atomicity — all or nothing
  const created = await prisma.$transaction(async (tx) => {
    // Collect all target dates to check for overlaps in one query
    const dates = entries.map((e) => new Date(e.date));
    const minDate = new Date(Math.min(...dates.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map((d) => d.getTime())));

    const existing = await tx.timeEntry.findMany({
      where: {
        userId,
        date: { gte: minDate, lte: maxDate },
      },
      select: { date: true, taskId: true },
    });

    // Build a set of existing date+taskId keys for overlap detection
    const existingKeys = new Set(
      existing.map((e) => {
        const dateStr = formatLocalDate(new Date(e.date));
        return `${dateStr}:${e.taskId ?? ""}`;
      })
    );

    // Also detect duplicates within the batch itself
    const batchKeys = new Set<string>();

    for (const entry of entries) {
      const key = `${entry.date}:${entry.taskId ?? ""}`;
      if (existingKeys.has(key)) {
        throw new ValidationError(
          `重複：${entry.date} 的任務 ${entry.taskId ?? "(無任務)"} 已有工時記錄`
        );
      }
      if (batchKeys.has(key)) {
        throw new ValidationError(
          `批次內重複：${entry.date} 的任務 ${entry.taskId ?? "(無任務)"} 出現多次`
        );
      }
      batchKeys.add(key);
    }

    // Create entries one by one within the transaction (for include support)
    const results = [];
    for (const entry of entries) {
      const result = await tx.timeEntry.create({
        data: {
          userId,
          taskId: entry.taskId || null,
          date: new Date(entry.date),
          hours: entry.hours,
          category: (entry.category as TimeCategory) ?? "PLANNED_TASK",
          description: entry.description || null,
        },
        include: {
          task: { select: { id: true, title: true, category: true } },
        },
      });
      results.push(result);
    }

    return results;
  });

  return success(created, 201);
});
