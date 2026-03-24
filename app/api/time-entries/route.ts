import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { TimeCategory } from "@prisma/client";
import { UnauthorizedError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createTimeEntrySchema } from "@/validators/time-entry-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId") || session.user.id;
  const weekStart = searchParams.get("weekStart");

  const where: Record<string, unknown> = { userId };

  if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    where.date = { gte: start, lte: end };
  }

  const entries = await prisma.timeEntry.findMany({
    where,
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });

  return success(entries);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const raw = await req.json();
  const { taskId, date, hours, category, description } = validateBody(createTimeEntrySchema, raw);

  const entry = await prisma.timeEntry.create({
    data: {
      taskId: taskId || null,
      userId: session.user.id,
      date: new Date(date),
      hours,
      category: (category as TimeCategory) ?? "PLANNED_TASK",
      description: description || null,
    },
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
  });

  return success(entry, 201);
});
