import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateGoalSchema } from "@/validators/plan-validators";
import { isValidGoalTransition } from "@/lib/state-machines";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const goal = await prisma.monthlyGoal.findUnique({
    where: { id },
    include: {
      annualPlan: { select: { id: true, title: true, year: true, archivedAt: true } },
      assignee: { select: { id: true, name: true, avatar: true } },
      tasks: {
        include: {
          primaryAssignee: { select: { id: true, name: true, avatar: true } },
          backupAssignee: { select: { id: true, name: true, avatar: true } },
          subTasks: true,
          deliverables: true,
        },
        orderBy: [{ priority: "asc" }, { dueDate: "asc" }],
      },
      deliverables: true,
    },
  });

  if (!goal) throw new NotFoundError("目標不存在");
  return success(goal);
});

export const PUT = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const existing = await prisma.monthlyGoal.findUnique({
    where: { id },
    include: { annualPlan: { select: { archivedAt: true } } },
  });
  if (!existing) throw new NotFoundError("目標不存在");
  if (existing.annualPlan.archivedAt) {
    throw new ValidationError("計畫已封存，無法編輯目標");
  }

  const raw = await req.json();
  const body = validateBody(updateGoalSchema, raw);

  // Banking compliance: enforce goal state machine
  if (body.status && body.status !== existing.status) {
    if (!isValidGoalTransition(existing.status as Parameters<typeof isValidGoalTransition>[0], body.status as Parameters<typeof isValidGoalTransition>[0])) {
      throw new ValidationError(`無法從 ${existing.status} 轉換為 ${body.status}`);
    }
  }

  const completedAt =
    body.status === "COMPLETED" && existing.status !== "COMPLETED"
      ? new Date()
      : body.status !== undefined && body.status !== "COMPLETED" ? null : undefined;

  const goal = await prisma.monthlyGoal.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.progressPct !== undefined && { progressPct: body.progressPct }),
      ...(body.assigneeId !== undefined && { assigneeId: body.assigneeId || null }),
      ...(body.retrospectiveNote !== undefined && { retrospectiveNote: body.retrospectiveNote }),
      ...(completedAt !== undefined && { completedAt }),
    },
    include: {
      annualPlan: { select: { id: true, title: true, year: true } },
      assignee: { select: { id: true, name: true, avatar: true } },
      tasks: true,
    },
  });

  return success(goal);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  const existing = await prisma.monthlyGoal.findUnique({
    where: { id },
    include: { annualPlan: { select: { archivedAt: true } } },
  });
  if (!existing) throw new NotFoundError("目標不存在");
  if (existing.annualPlan.archivedAt) {
    throw new ValidationError("計畫已封存，無法刪除目標");
  }

  await prisma.task.updateMany({ where: { monthlyGoalId: id }, data: { monthlyGoalId: null } });
  await prisma.monthlyGoal.delete({ where: { id } });

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_GOAL",
    resourceType: "MonthlyGoal",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ deleted: true });
});
