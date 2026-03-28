import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { TimeCategory } from "@prisma/client";
import { ForbiddenError, ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { createTimeEntrySchema } from "@/validators/time-entry-validators";
import { validateDailyLimit } from "@/validators/shared/time-entry";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

const READ_ALL_ROLES = new Set(["MANAGER", "ADMIN"]);

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const callerId = session.user.id;
  const callerRole = session.user.role ?? "ENGINEER";

  const { searchParams } = new URL(req.url);
  const requestedUserId = searchParams.get("userId");
  const weekStart = searchParams.get("weekStart");

  // IDOR: non-privileged callers can only query their own entries.
  if (requestedUserId && requestedUserId !== callerId && !READ_ALL_ROLES.has(callerRole)) {
    throw new ForbiddenError("其他使用者的時間記錄無法存取");
  }

  // Scope to caller unless a privileged role requests a specific user.
  const userId = READ_ALL_ROLES.has(callerRole) && requestedUserId
    ? requestedUserId
    : callerId;

  // Banking compliance: exclude soft-deleted entries from normal queries
  const where: Record<string, unknown> = { userId, isDeleted: false };

  if (weekStart) {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    where.date = { gte: start, lte: end };
  }

  // Issue #940: defensive try — if subTask relation is unavailable (e.g. pending
  // migration), fall back to a query without the subTask include so the API
  // never returns 500 for a missing column.
  let entries;
  try {
    entries = await prisma.timeEntry.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, category: true } },
        subTask: { select: { id: true, title: true } },  // Issue #933
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  } catch {
    entries = await prisma.timeEntry.findMany({
      where,
      include: {
        task: { select: { id: true, title: true, category: true } },
      },
      orderBy: [{ date: "asc" }, { createdAt: "asc" }],
    });
  }

  return success(entries);
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const raw = await req.json();
  const { taskId, date, hours, category, description, subTaskId } = validateBody(createTimeEntrySchema, raw);

  // Issue #933: validate subTaskId belongs to the specified taskId
  if (subTaskId) {
    if (!taskId) {
      throw new ValidationError("選擇子任務時必須先指定主任務");
    }
    const subTask = await prisma.subTask.findUnique({
      where: { id: subTaskId },
      select: { taskId: true },
    });
    if (!subTask || subTask.taskId !== taskId) {
      throw new ValidationError("子任務不屬於所選主任務");
    }
  }

  // T-1: Enforce daily 24hr limit — sum existing entries for this date
  const targetDate = new Date(date);
  const existingEntries = await prisma.timeEntry.findMany({
    where: {
      userId: session.user.id,
      date: targetDate,
    },
    select: { hours: true },
  });
  const existingTotal = existingEntries.reduce((sum, e) => sum + e.hours, 0);
  const limitError = validateDailyLimit(existingTotal, hours);
  if (limitError) {
    throw new ValidationError(limitError);
  }

  // Always create entries owned by the caller — ignores any userId in body.
  // #928: Manager time entries auto-approve (no approval workflow needed)
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  const entry = await prisma.timeEntry.create({
    data: {
      taskId: taskId || null,
      subTaskId: subTaskId || null,       // Issue #933
      userId: session.user.id,
      date: new Date(date),
      hours,
      category: (category as TimeCategory) ?? "PLANNED_TASK",
      description: description || null,
      ...(isManager ? { approvalStatus: "APPROVED", locked: true } : {}),
    },
    include: {
      task: { select: { id: true, title: true, category: true } },
      subTask: { select: { id: true, title: true } },  // Issue #933
    },
  });

  return success(entry, 201);
});
