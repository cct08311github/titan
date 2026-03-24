import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TimeCategory } from "@prisma/client";
import { UnauthorizedError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateTimeEntrySchema } from "@/validators/time-entry-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const PUT = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const raw = await req.json();
  const { taskId, date, hours, category, description } = validateBody(updateTimeEntrySchema, raw);

  const updates: Record<string, unknown> = {};
  if (taskId !== undefined) updates.taskId = taskId || null;
  if (date !== undefined) updates.date = new Date(date);
  if (hours !== undefined) updates.hours = hours;
  if (category !== undefined) updates.category = category as TimeCategory;
  if (description !== undefined) updates.description = description || null;

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: updates,
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
  });

  return success(entry);
});

export const DELETE = apiHandler(async (
  _req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  await prisma.timeEntry.delete({ where: { id } });
  return success({ success: true });
});
