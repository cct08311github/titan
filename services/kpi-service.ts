import { PrismaClient, KPIStatus } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListKPIsFilter {
  year?: number;
}

export interface CreateKPIInput {
  year: number;
  code: string;
  title: string;
  description?: string | null;
  target: number;
  weight?: number;
  autoCalc?: boolean;
  createdBy: string;
}

export interface UpdateKPIInput {
  title?: string;
  description?: string | null;
  target?: number;
  actual?: number;
  weight?: number;
  status?: KPIStatus | string;
  autoCalc?: boolean;
}

export class KPIService {
  constructor(private readonly prisma: PrismaClient) {}

  async listKPIs(filter: ListKPIsFilter) {
    const year = filter.year ?? new Date().getFullYear();
    return this.prisma.kPI.findMany({
      where: { year },
      include: {
        taskLinks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                progressPct: true,
                primaryAssignee: { select: { id: true, name: true } },
              },
            },
          },
        },
        deliverables: true,
        creator: { select: { id: true, name: true } },
      },
      orderBy: { code: "asc" },
    });
  }

  async getKPI(id: string) {
    const kpi = await this.prisma.kPI.findUnique({
      where: { id },
      include: {
        taskLinks: {
          include: {
            task: {
              select: {
                id: true,
                title: true,
                status: true,
                progressPct: true,
              },
            },
          },
        },
        deliverables: true,
        creator: { select: { id: true, name: true } },
      },
    });

    if (!kpi) throw new NotFoundError(`KPI not found: ${id}`);
    return kpi;
  }

  async createKPI(input: CreateKPIInput) {
    if (!input.title?.trim()) {
      throw new ValidationError("標題為必填");
    }
    if (input.target == null) {
      throw new ValidationError("目標值為必填");
    }

    return this.prisma.kPI.create({
      data: {
        year: input.year,
        code: input.code,
        title: input.title,
        description: input.description ?? null,
        target: input.target,
        weight: input.weight ?? 1,
        autoCalc: input.autoCalc ?? false,
        createdBy: input.createdBy,
      },
    });
  }

  async updateKPI(id: string, input: UpdateKPIInput) {
    const existing = await this.prisma.kPI.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`KPI not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.title !== undefined) updates.title = input.title;
    if (input.description !== undefined) updates.description = input.description;
    if (input.target !== undefined) updates.target = input.target;
    if (input.actual !== undefined) updates.actual = input.actual;
    if (input.weight !== undefined) updates.weight = input.weight;
    if (input.status !== undefined) updates.status = input.status;
    if (input.autoCalc !== undefined) updates.autoCalc = input.autoCalc;

    return this.prisma.kPI.update({ where: { id }, data: updates });
  }

  async linkTask(kpiId: string, taskId: string, weight = 1) {
    return this.prisma.kPITaskLink.create({
      data: { kpiId, taskId, weight },
    });
  }

  async unlinkTask(kpiId: string, taskId: string) {
    return this.prisma.kPITaskLink.deleteMany({
      where: { kpiId, taskId },
    });
  }

  async calculateAchievement(kpiId: string) {
    const kpi = await this.prisma.kPI.findUnique({
      where: { id: kpiId },
      include: {
        taskLinks: {
          include: {
            task: { select: { progressPct: true, status: true } },
          },
        },
      },
    });

    if (!kpi) throw new NotFoundError(`KPI not found: ${kpiId}`);

    const links = kpi.taskLinks;
    let actual = 0;
    if (links.length > 0) {
      const totalWeight = links.reduce((sum, l) => sum + l.weight, 0);
      const weightedSum = links.reduce(
        (sum, l) => sum + l.task.progressPct * l.weight,
        0
      );
      actual = totalWeight > 0 ? weightedSum / totalWeight : 0;
    }

    return this.prisma.kPI.update({
      where: { id: kpiId },
      data: { actual },
    });
  }
}
