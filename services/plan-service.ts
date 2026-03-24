import { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListPlansFilter {
  year?: number;
}

export interface MilestoneInput {
  title: string;
  plannedEnd: Date | string;
  plannedStart?: Date | string | null;
  description?: string | null;
  order?: number;
}

export interface CreatePlanInput {
  year: number;
  title: string;
  description?: string | null;
  implementationPlan?: string | null;
  createdBy: string;
  milestones?: MilestoneInput[];
}

export interface UpdatePlanInput {
  title?: string;
  description?: string | null;
  implementationPlan?: string | null;
  progressPct?: number;
}

export class PlanService {
  constructor(private readonly prisma: PrismaClient) {}

  async listPlans(filter: ListPlansFilter) {
    return this.prisma.annualPlan.findMany({
      where: filter.year ? { year: filter.year } : undefined,
      include: {
        creator: { select: { id: true, name: true } },
        milestones: { orderBy: { order: "asc" } },
        monthlyGoals: {
          orderBy: { month: "asc" },
          include: { _count: { select: { tasks: true } } },
        },
        _count: { select: { monthlyGoals: true } },
      },
      orderBy: { year: "desc" },
    });
  }

  async getPlan(id: string) {
    const plan = await this.prisma.annualPlan.findUnique({
      where: { id },
      include: {
        creator: { select: { id: true, name: true } },
        milestones: { orderBy: { order: "asc" } },
        monthlyGoals: {
          orderBy: { month: "asc" },
          include: {
            _count: { select: { tasks: true } },
            deliverables: true,
          },
        },
        deliverables: true,
      },
    });

    if (!plan) throw new NotFoundError(`Plan not found: ${id}`);
    return plan;
  }

  async createPlan(input: CreatePlanInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }
    if (!input.year || input.year < 2000) {
      throw new ValidationError("年份為必填");
    }

    return this.prisma.annualPlan.create({
      data: {
        year: input.year,
        title: input.title,
        description: input.description ?? null,
        implementationPlan: input.implementationPlan ?? null,
        createdBy: input.createdBy,
        milestones: input.milestones?.length
          ? {
              create: input.milestones.map((m, i) => ({
                title: m.title,
                plannedEnd: new Date(m.plannedEnd),
                plannedStart: m.plannedStart ? new Date(m.plannedStart) : null,
                description: m.description ?? null,
                order: m.order ?? i,
              })),
            }
          : undefined,
      },
      include: {
        milestones: true,
        monthlyGoals: true,
      },
    });
  }

  async updatePlan(id: string, input: UpdatePlanInput) {
    const existing = await this.prisma.annualPlan.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Plan not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.implementationPlan !== undefined) updates.implementationPlan = input.implementationPlan;
    if (input.progressPct !== undefined) updates.progressPct = input.progressPct;

    return this.prisma.annualPlan.update({
      where: { id },
      data: updates,
      include: {
        milestones: true,
        monthlyGoals: true,
      },
    });
  }

  async deletePlan(id: string) {
    const plan = await this.prisma.annualPlan.findUnique({ where: { id } });
    if (!plan) throw new NotFoundError(`Plan not found: ${id}`);

    return this.prisma.annualPlan.delete({ where: { id } });
  }
}
