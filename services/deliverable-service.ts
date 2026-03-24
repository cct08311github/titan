import { PrismaClient, DeliverableStatus, DeliverableType } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListDeliverablesFilter {
  taskId?: string;
  kpiId?: string;
  annualPlanId?: string;
  monthlyGoalId?: string;
  status?: DeliverableStatus | string;
  type?: DeliverableType | string;
}

export interface CreateDeliverableInput {
  title: string;
  type: string;
  taskId?: string | null;
  kpiId?: string | null;
  annualPlanId?: string | null;
  monthlyGoalId?: string | null;
  attachmentUrl?: string | null;
}

export interface UpdateDeliverableInput {
  title?: string;
  status?: string;
  attachmentUrl?: string | null;
  acceptedBy?: string | null;
  acceptedAt?: Date | string | null;
}

export class DeliverableService {
  constructor(private readonly prisma: PrismaClient) {}

  async listDeliverables(filter: ListDeliverablesFilter) {
    const where: Record<string, unknown> = {};

    if (filter.taskId) where.taskId = filter.taskId;
    if (filter.kpiId) where.kpiId = filter.kpiId;
    if (filter.annualPlanId) where.annualPlanId = filter.annualPlanId;
    if (filter.monthlyGoalId) where.monthlyGoalId = filter.monthlyGoalId;
    if (filter.status) where.status = filter.status;
    if (filter.type) where.type = filter.type;

    return this.prisma.deliverable.findMany({
      where,
      include: {
        task: { select: { id: true, title: true } },
        kpi: { select: { id: true, code: true, title: true } },
        annualPlan: { select: { id: true, title: true, year: true } },
        monthlyGoal: { select: { id: true, title: true, month: true } },
        acceptor: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async getDeliverable(id: string) {
    const deliverable = await this.prisma.deliverable.findUnique({
      where: { id },
      include: {
        task: { select: { id: true, title: true } },
        kpi: { select: { id: true, code: true, title: true } },
        annualPlan: { select: { id: true, title: true, year: true } },
        monthlyGoal: { select: { id: true, title: true, month: true } },
        acceptor: { select: { id: true, name: true, avatar: true } },
      },
    });

    if (!deliverable) throw new NotFoundError(`Deliverable not found: ${id}`);
    return deliverable;
  }

  async createDeliverable(input: CreateDeliverableInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }
    if (!input.type?.trim()) {
      throw new ValidationError("類型為必填");
    }

    return this.prisma.deliverable.create({
      data: {
        title: input.title,
        type: input.type as DeliverableType,
        taskId: input.taskId ?? null,
        kpiId: input.kpiId ?? null,
        annualPlanId: input.annualPlanId ?? null,
        monthlyGoalId: input.monthlyGoalId ?? null,
        attachmentUrl: input.attachmentUrl ?? null,
      },
    });
  }

  async updateDeliverable(id: string, input: UpdateDeliverableInput) {
    const existing = await this.prisma.deliverable.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Deliverable not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.status !== undefined) updates.status = input.status;
    if (input.attachmentUrl !== undefined) updates.attachmentUrl = input.attachmentUrl ?? null;
    if (input.acceptedBy !== undefined) updates.acceptedBy = input.acceptedBy ?? null;
    if (input.acceptedAt !== undefined) {
      updates.acceptedAt = input.acceptedAt ? new Date(input.acceptedAt as string) : null;
    }

    return this.prisma.deliverable.update({
      where: { id },
      data: updates,
    });
  }

  async deleteDeliverable(id: string) {
    const existing = await this.prisma.deliverable.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`Deliverable not found: ${id}`);

    return this.prisma.deliverable.delete({ where: { id } });
  }
}
