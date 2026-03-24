import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, NotFoundError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updatePlanSchema } from "@/validators/plan-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";

export const GET = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { id } = await context!.params;
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

export const PUT = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const raw = await req.json();
  const { title, description, implementationPlan, progressPct } = validateBody(updatePlanSchema, raw);

  const plan = await prisma.annualPlan.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(implementationPlan !== undefined && { implementationPlan }),
      ...(progressPct !== undefined && { progressPct }),
    },
    include: { milestones: true, monthlyGoals: true },
  });

  return success(plan);
});
