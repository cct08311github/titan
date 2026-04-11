/**
 * POST /api/time-entries/start — Start a new timer (Issue #711)
 *
 * Creates a TimeEntry with isRunning=true and startTime=now().
 * Returns 409 if the user already has a running timer.
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { ConflictError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";

const startTimerSchema = z.object({
  taskId: z.string().min(1).optional(),
  category: z.enum(["PLANNED_TASK", "ADDED_TASK", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"]).optional(),
  description: z.string().max(500).optional(),
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  // Parse optional fields from body
  let taskId: string | null = null;
  let category: TimeCategory = "PLANNED_TASK";
  let description: string | null = null;

  try {
    const raw = await req.json();
    const body = validateBody(startTimerSchema, raw);
    if (body.taskId) taskId = body.taskId;
    if (body.category) category = body.category as TimeCategory;
    if (body.description) description = body.description;
  } catch {
    // Empty body is fine — start timer without task
  }

  const now = new Date();

  // TOCTOU fix: wrap findFirst + create in a transaction so concurrent requests
  // cannot both pass the running-timer check before either insert commits.
  const entry = await prisma.$transaction(async (tx) => {
    const existing = await tx.timeEntry.findFirst({
      where: { userId, isRunning: true },
    });

    if (existing) {
      throw new ConflictError("已有正在計時的項目，請先停止目前計時器");
    }

    return tx.timeEntry.create({
      data: {
        userId,
        taskId,
        date: now,
        hours: 0,
        startTime: now,
        endTime: null,
        isRunning: true,
        category,
        description,
      },
      include: {
        task: { select: { id: true, title: true, category: true } },
      },
    });
  });

  return success(entry, 201);
});
