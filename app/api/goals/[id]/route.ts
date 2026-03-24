import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError, NotFoundError } from "@/services/errors";
import { validateBody } from "@/lib/validate";
import { updateGoalSchema } from "@/validators/plan-validators";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const GET = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session) throw new UnauthorizedError();

  const { id } = await context!.params;
  const goal = await prisma.monthlyGoal.findUnique({
    where: { id },
    include: {
      annualPlan: { select: { id: true, title: true, year: true } },
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

export const PUT = apiHandler(async (
  req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const { id } = await context!.params;
  const raw = await req.json();
  const { title, description, status, progressPct } = validateBody(updateGoalSchema, raw);

  const goal = await prisma.monthlyGoal.update({
    where: { id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(progressPct !== undefined && { progressPct }),
    },
    include: {
      annualPlan: { select: { id: true, title: true, year: true } },
      tasks: true,
    },
  });

  return success(goal);
});

export const DELETE = withManager(async (
  _req: NextRequest,
  context?: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context!.params;
  const existing = await prisma.monthlyGoal.findUnique({ where: { id } });
  if (!existing) throw new NotFoundError("目標不存在");

  await prisma.task.updateMany({
    where: { monthlyGoalId: id },
    data: { monthlyGoalId: null },
  });
  await prisma.monthlyGoal.delete({ where: { id } });
  return success({ deleted: true });
});
