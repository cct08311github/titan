import { PrismaClient } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "./errors";
import { calculatePlanProgress } from "@/lib/progress-calc";

/**
 * Shift a Date by a given number of years, preserving month/day.
 */
function shiftDateByYears(date: Date, years: number): Date {
  const shifted = new Date(date);
  shifted.setFullYear(shifted.getFullYear() + years);
  return shifted;
}

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
  vision?: string | null;
  description?: string | null;
  implementationPlan?: string | null;
  createdBy: string;
  milestones?: MilestoneInput[];
}

export interface UpdatePlanInput {
  title?: string;
  vision?: string | null;
  description?: string | null;
  implementationPlan?: string | null;
  progressPct?: number;
}

export class PlanService {
  constructor(private readonly prisma: PrismaClient) {}

  async listPlans(filter: ListPlansFilter) {
    const plans = await this.prisma.annualPlan.findMany({
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
      orderBy: [{ year: "desc" }, { createdAt: "desc" }],
    });

    // Auto-compute progressPct from goal statuses
    return plans.map((plan) => ({
      ...plan,
      progressPct: calculatePlanProgress(plan.monthlyGoals),
    }));
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

    const existing = await this.prisma.annualPlan.findFirst({
      where: { year: input.year },
    });
    if (existing) {
      throw new ConflictError("該年度計畫已存在");
    }

    return this.prisma.annualPlan.create({
      data: {
        year: input.year,
        title: input.title,
        vision: input.vision ?? null,
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
    if (input.vision !== undefined) updates.vision = input.vision;
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

  /**
   * Copy an annual plan as a template to a new target year.
   * Copies: plan metadata, monthly goals, and milestones.
   * Milestone dates are shifted by the year delta (e.g. 2025→2026 shifts +1 year).
   * Monthly goals and milestones are reset to initial status.
   */
  async copyTemplate(sourcePlanId: string, targetYear: number, createdBy: string) {
    const source = await this.prisma.annualPlan.findUnique({
      where: { id: sourcePlanId },
      include: {
        monthlyGoals: {
          orderBy: { month: "asc" },
        },
        milestones: {
          orderBy: { order: "asc" },
        },
      },
    });

    if (!source) throw new NotFoundError(`Plan not found: ${sourcePlanId}`);

    // Shift milestone dates by the year delta
    const yearDelta = targetYear - source.year;

    return this.prisma.annualPlan.create({
      data: {
        year: targetYear,
        title: source.title,
        vision: source.vision ?? null,
        description: source.description ?? null,
        implementationPlan: source.implementationPlan ?? null,
        copiedFromYear: source.year,
        createdBy,
        monthlyGoals: source.monthlyGoals.length
          ? {
              create: source.monthlyGoals.map((g) => ({
                month: g.month,
                title: g.title,
                description: g.description ?? null,
                status: "NOT_STARTED" as const,
                progressPct: 0,
              })),
            }
          : undefined,
        milestones: source.milestones.length
          ? {
              create: source.milestones.map((m) => ({
                title: m.title,
                description: m.description ?? null,
                plannedStart: m.plannedStart
                  ? shiftDateByYears(m.plannedStart, yearDelta)
                  : null,
                plannedEnd: shiftDateByYears(m.plannedEnd, yearDelta),
                actualStart: null,
                actualEnd: null,
                status: "PENDING" as const,
                order: m.order,
              })),
            }
          : undefined,
      },
      include: {
        monthlyGoals: true,
        milestones: true,
      },
    });
  }
}
