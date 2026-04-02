import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError, ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updatePlanSchema } from "@/validators/plan-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { PlanService } from "@/services/plan-service";
import { AuditService } from "@/services/audit-service";
import { getClientIp } from "@/lib/get-client-ip";

const planService = new PlanService(prisma);
const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const plan = await prisma.annualPlan.findUnique({
    where: { id },
    include: {
      creator: { select: { id: true, name: true } },
      milestones: { orderBy: { order: "asc" } },
      deliverables: true,
      monthlyGoals: {
        orderBy: { month: "asc" },
        include: {
          tasks: {
            include: {
              primaryAssignee: { select: { id: true, name: true, avatar: true } },
              backupAssignee: { select: { id: true, name: true, avatar: true } },
              _count: { select: { subTasks: true } },
            },
          },
          deliverables: true,
        },
      },
    },
  });

  if (!plan) throw new NotFoundError("計畫不存在");
  return success(plan);
});

/**
 * DELETE /api/plans/:id — 刪除計畫（hard delete）
 * 僅 Manager 角色可執行。
 */
export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  await planService.deletePlan(id);

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_PLAN",
    resourceType: "AnnualPlan",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});

/**
 * PATCH /api/plans/:id — 編輯或封存/解封計畫
 * 封存後僅允許 archived=false（解除封存），其他欄位不可修改。
 */
export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const existing = await prisma.annualPlan.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("計畫不存在");

  const raw = await req.json();
  const body = validateBody(updatePlanSchema, raw);

  // If plan is archived, only allow un-archiving
  if (existing.archivedAt !== null) {
    if (body.archived !== false) {
      throw new ValidationError("計畫已封存，不可編輯。僅允許解除封存。");
    }
    const plan = await prisma.annualPlan.update({
      where: { id },
      data: { archivedAt: null },
      include: { milestones: true, monthlyGoals: true },
    });
    return success(plan);
  }

  // Handle archive request
  if (body.archived === true) {
    const plan = await prisma.annualPlan.update({
      where: { id },
      data: { archivedAt: new Date() },
      include: { milestones: true, monthlyGoals: true },
    });
    return success(plan);
  }

  // Normal edit (not archived)
  const plan = await prisma.annualPlan.update({
    where: { id },
    data: {
      ...(body.title !== undefined && { title: body.title }),
      ...(body.vision !== undefined && { vision: body.vision }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.implementationPlan !== undefined && { implementationPlan: body.implementationPlan }),
      ...(body.progressPct !== undefined && { progressPct: body.progressPct }),
    },
    include: { milestones: true, monthlyGoals: true },
  });

  return success(plan);
});
