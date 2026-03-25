/**
 * POST /api/time-entries/templates/[id]/apply — Apply a template (TS-30)
 *
 * Creates time entries from a saved template for a specific date.
 * Skips entries that would overlap with existing ones on the target date.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { NotFoundError, ForbiddenError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";

const applySchema = z.object({
  date: z.string().date(),
});

interface TemplateEntry {
  hours: number;
  category?: string;
  taskId?: string;
  description?: string;
}

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const userId = session.user.id;
  const { id } = await context.params;

  const template = await prisma.timeEntryTemplate.findUnique({ where: { id } });
  if (!template) throw new NotFoundError(`Template not found: ${id}`);

  // Only the template owner can apply it
  if ((template as unknown as { userId: string }).userId !== userId) {
    throw new ForbiddenError("只能使用自己的模板");
  }

  const raw = await req.json();
  const { date } = validateBody(applySchema, raw);
  const targetDate = new Date(date);

  const entries: TemplateEntry[] = JSON.parse(
    typeof template.entries === "string"
      ? template.entries
      : JSON.stringify(template.entries)
  );

  // Check existing entries for the target date to avoid duplicates
  const existing = await prisma.timeEntry.findMany({
    where: { userId, date: targetDate },
    select: { taskId: true },
  });
  const existingTaskIds = new Set(existing.map((e) => e.taskId ?? ""));

  const created = [];
  for (const entry of entries) {
    // Skip if same task already has an entry on this date
    const taskKey = entry.taskId ?? "";
    if (existingTaskIds.has(taskKey)) continue;

    const result = await prisma.timeEntry.create({
      data: {
        userId,
        taskId: entry.taskId || null,
        date: targetDate,
        hours: entry.hours,
        category: (entry.category as TimeCategory) ?? "PLANNED_TASK",
        description: entry.description || null,
      },
    });
    created.push(result);
    existingTaskIds.add(taskKey);
  }

  return success(created, 201);
});
