import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createGoalSchema } from "@/validators/plan-validators";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";
import { parseMonth } from "@/lib/query-params";
import { parsePagination } from "@/lib/pagination";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId");
  const month = searchParams.get("month");
  const { page, limit, skip } = parsePagination(searchParams);

  const where = {
    ...(planId && { annualPlanId: planId }),
    ...(month !== null && { month: parseMonth(month) }),
  };

  const [goals, total] = await Promise.all([
    prisma.monthlyGoal.findMany({
      where,
      include: {
        annualPlan: { select: { id: true, title: true, year: true, archivedAt: true } },
        assignee: { select: { id: true, name: true, avatar: true } },
        _count: { select: { tasks: true } },
        deliverables: true,
      },
      orderBy: [{ annualPlanId: "asc" }, { month: "asc" }],
      skip,
      take: limit,
    }),
    prisma.monthlyGoal.count({ where }),
  ]);

  return success({ items: goals, total, page, limit });
});

export const POST = withManager(async (req: NextRequest) => {
  const raw = await req.json();
  const { annualPlanId, month, title, description, assigneeId, retrospectiveNote } = validateBody(createGoalSchema, raw);

  const plan = await prisma.annualPlan.findUnique({ where: { id: annualPlanId } });
  if (plan?.archivedAt) {
    throw new ValidationError("計畫已封存，無法新增目標");
  }

  if (assigneeId) {
    const user = await prisma.user.findUnique({ where: { id: assigneeId } });
    if (!user || !user.isActive) {
      throw new ValidationError("負責人必須是有效的使用者");
    }
  }

  const goal = await prisma.monthlyGoal.create({
    data: { annualPlanId, month, title, description: description || null, assigneeId: assigneeId || null, retrospectiveNote: retrospectiveNote || null },
    include: {
      annualPlan: { select: { id: true, title: true, year: true } },
      assignee: { select: { id: true, name: true, avatar: true } },
      tasks: true,
    },
  });

  return success(goal, 201);
});
