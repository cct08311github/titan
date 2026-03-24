import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { createGoalSchema } from "@/validators/plan-validators";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const planId = searchParams.get("planId");
  const month = searchParams.get("month");

  const goals = await prisma.monthlyGoal.findMany({
    where: {
      ...(planId && { annualPlanId: planId }),
      ...(month && { month: parseInt(month) }),
    },
    include: {
      annualPlan: { select: { id: true, title: true, year: true } },
      _count: { select: { tasks: true } },
      deliverables: true,
    },
    orderBy: [{ annualPlanId: "asc" }, { month: "asc" }],
  });

  return success(goals);
});

export const POST = withAuth(async (req: NextRequest) => {
  const raw = await req.json();
  const { annualPlanId, month, title, description } = validateBody(createGoalSchema, raw);

  const goal = await prisma.monthlyGoal.create({
    data: {
      annualPlanId,
      month,
      title,
      description: description || null,
    },
    include: {
      annualPlan: { select: { id: true, title: true, year: true } },
      tasks: true,
    },
  });

  return success(goal, 201);
});
