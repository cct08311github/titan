import { PrismaClient, GoalStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListGoalsFilter {
  planId?: string;
  month?: number;
}

export interface CreateGoalInput {
  annualPlanId: string;
  month: number;
  title: string;
  description?: string | null;
}

export interface UpdateGoalInput {
  title?: string;
  description?: string | null;
  status?: GoalStatus | string;
  progressPct?: number;
}

export class GoalService {
  constructor(private readonly prisma: PrismaClient) {}

  async listGoals(filter: ListGoalsFilter) {
    return this.prisma.monthlyGoal.findMany({
      where: {
        ...(filter.planId && { annualPlanId: filter.planId }),
        ...(filter.month && { month: filter.month }),
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        _count: { select: { tasks: true } },
        deliverables: true,
      },
      orderBy: [{ annualPlanId: "asc" }, { month: "asc" }],
    });
  }

  async getGoal(id: string) {
    const goal = await this.prisma.monthlyGoal.findUnique({
      where: { id },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        tasks: {
          include: {
            primaryAssignee: { select: { id: true, name: true, avatar: true } },
          },
        },
        deliverables: true,
      },
    });

    if (!goal) throw new NotFoundError(`Goal not found: ${id}`);
    return goal;
  }

  async createGoal(input: CreateGoalInput) {
    if (!input.annualPlanId?.trim()) {
      throw new ValidationError("計畫ID為必填");
    }
    if (!input.month || input.month < 1 || input.month > 12) {
      throw new ValidationError("月份必須介於 1-12");
    }
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }

    return this.prisma.monthlyGoal.create({
      data: {
        annualPlanId: input.annualPlanId,
        month: input.month,
        title: input.title,
        description: input.description ?? null,
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
        tasks: true,
      },
    });
  }

  async updateGoal(id: string, input: UpdateGoalInput) {
    const existing = await this.prisma.monthlyGoal.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Goal not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.status !== undefined) updates.status = input.status;
    if (input.progressPct !== undefined) updates.progressPct = input.progressPct;

    return this.prisma.monthlyGoal.update({
      where: { id },
      data: updates,
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
      },
    });
  }

  async deleteGoal(id: string) {
    const goal = await this.prisma.monthlyGoal.findUnique({ where: { id } });
    if (!goal) throw new NotFoundError(`Goal not found: ${id}`);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.task.updateMany({
          where: { monthlyGoalId: id },
          data: { monthlyGoalId: null },
        });
        return tx.monthlyGoal.delete({ where: { id } });
      },
      { timeout: 10000 }
    );
  }
}
