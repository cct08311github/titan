/**
 * POST /api/time-entries/copy-week — Copy previous week entries (TS-07)
 *
 * Deep copies all time entries from sourceWeekStart..+6 days to the next week
 * (date + 7 days). Skips entries where target date + taskId already exist.
 *
 * Copied fields: taskId, hours, category, description
 * NOT copied: id, locked, isRunning, startTime, endTime
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { formatLocalDate } from "@/lib/utils/date";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";

const copyWeekSchema = z.object({
  sourceWeekStart: z.string().date(),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const raw = await req.json();
  const { sourceWeekStart } = validateBody(copyWeekSchema, raw);

  const srcStart = new Date(sourceWeekStart);
  const srcEnd = new Date(srcStart);
  srcEnd.setDate(srcEnd.getDate() + 6);

  const tgtStart = new Date(srcStart);
  tgtStart.setDate(tgtStart.getDate() + 7);
  const tgtEnd = new Date(tgtStart);
  tgtEnd.setDate(tgtEnd.getDate() + 6);

  // Fetch source week entries — exclude deleted and actively running entries
  const sourceEntries = await prisma.timeEntry.findMany({
    where: {
      userId,
      date: { gte: srcStart, lte: srcEnd },
      isDeleted: false,
      isRunning: false,
    },
  });

  if (sourceEntries.length === 0) {
    return success({ copied: 0, skipped: 0, message: "來源週無工時記錄" });
  }

  // Fetch target week entries to detect duplicates
  const targetEntries = await prisma.timeEntry.findMany({
    where: {
      userId,
      date: { gte: tgtStart, lte: tgtEnd },
    },
    select: { date: true, taskId: true },
  });

  const targetKeys = new Set(
    targetEntries.map((e) => {
      const dateStr = formatLocalDate(new Date(e.date));
      return `${dateStr}:${e.taskId ?? ""}`;
    })
  );

  // Build entries to copy, skipping duplicates
  const toCopy = [];
  let skipped = 0;

  for (const entry of sourceEntries) {
    const srcDate = new Date(entry.date);
    const tgtDate = new Date(srcDate);
    tgtDate.setDate(tgtDate.getDate() + 7);
    const tgtDateStr = formatLocalDate(tgtDate);

    const key = `${tgtDateStr}:${entry.taskId ?? ""}`;
    if (targetKeys.has(key)) {
      skipped++;
      continue;
    }

    toCopy.push({
      userId,
      taskId: entry.taskId,
      date: tgtDate,
      hours: entry.hours,
      category: entry.category,
      description: entry.description,
    });
    targetKeys.add(key); // prevent duplicates within copy batch
  }

  if (toCopy.length === 0) {
    return success({ copied: 0, skipped, message: "目標週已有相同記錄，全部跳過" });
  }

  await prisma.timeEntry.createMany({ data: toCopy });

  // Fetch the newly created entries
  const newEntries = await prisma.timeEntry.findMany({
    where: {
      userId,
      date: { gte: tgtStart, lte: tgtEnd },
    },
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
    orderBy: [{ date: "asc" }],
  });

  return success({ copied: toCopy.length, skipped, entries: newEntries }, 201);
});
