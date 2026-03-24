import { PrismaClient, MilestoneStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListMilestonesFilter {
  planId?: string;
}

export interface CreateMilestoneInput {
  annualPlanId: string;
  title: string;
  description?: string | null;
  plannedStart?: Date | null;
  plannedEnd: Date;
  order?: number;
}

export interface UpdateMilestoneInput {
  title?: string;
  description?: string | null;
  plannedStart?: Date | null;
  plannedEnd?: Date;
  actualStart?: Date | null;
  actualEnd?: Date | null;
  status?: MilestoneStatus | string;
  order?: number;
}

export class MilestoneService {
  constructor(private readonly prisma: PrismaClient) {}

  async listMilestones(filter: ListMilestonesFilter) {
    return this.prisma.milestone.findMany({
      where: {
        ...(filter.planId && { annualPlanId: filter.planId }),
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
      },
      orderBy: [{ order: "asc" }, { plannedEnd: "asc" }],
    });
  }

  async getMilestone(id: string) {
    const milestone = await this.prisma.milestone.findUnique({
      where: { id },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
      },
    });

    if (!milestone) throw new NotFoundError(`Milestone not found: ${id}`);
    return milestone;
  }

  async createMilestone(input: CreateMilestoneInput) {
    if (!input.annualPlanId?.trim()) {
      throw new ValidationError("計畫ID為必填");
    }
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }
    if (input.plannedStart && input.plannedEnd) {
      if (input.plannedStart >= input.plannedEnd) {
        throw new ValidationError("plannedStart 必須早於 plannedEnd");
      }
    }

    return this.prisma.milestone.create({
      data: {
        annualPlanId: input.annualPlanId,
        title: input.title,
        description: input.description ?? null,
        plannedStart: input.plannedStart ?? null,
        plannedEnd: input.plannedEnd,
        order: input.order ?? 0,
      },
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
      },
    });
  }

  async updateMilestone(id: string, input: UpdateMilestoneInput) {
    const existing = await this.prisma.milestone.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Milestone not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.plannedStart !== undefined) updates.plannedStart = input.plannedStart;
    if (input.plannedEnd !== undefined) updates.plannedEnd = input.plannedEnd;
    if (input.actualStart !== undefined) updates.actualStart = input.actualStart;
    if (input.actualEnd !== undefined) updates.actualEnd = input.actualEnd;
    if (input.status !== undefined) updates.status = input.status;
    if (input.order !== undefined) updates.order = input.order;

    return this.prisma.milestone.update({
      where: { id },
      data: updates,
      include: {
        annualPlan: { select: { id: true, title: true, year: true } },
      },
    });
  }

  async deleteMilestone(id: string) {
    const milestone = await this.prisma.milestone.findUnique({ where: { id } });
    if (!milestone) throw new NotFoundError(`Milestone not found: ${id}`);

    return this.prisma.milestone.delete({ where: { id } });
  }
}
