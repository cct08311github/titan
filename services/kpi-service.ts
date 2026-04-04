import { PrismaClient, Prisma, KPIStatus } from "@prisma/client";
import { NotFoundError, ValidationError, ConflictError } from "./errors";
import { calculateAchievement as calcAchievement } from "../lib/kpi-calculator";

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

    try {
      return await this.prisma.kPI.create({
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
    } catch (err) {
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        const fields = (err.meta?.target as string[] | undefined) ?? [];
        if (fields.includes("title")) {
          throw new ConflictError("KPI 標題已存在（同年度不可重複）");
        }
        throw new ConflictError("KPI 代碼已存在（同年度不可重複）");
      }
      throw err;
    }
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

  async deleteKPI(id: string) {
    const existing = await this.prisma.kPI.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`KPI not found: ${id}`);

    return this.prisma.$transaction(
      async (tx) => {
        await tx.kPITaskLink.deleteMany({ where: { kpiId: id } });
        return tx.kPI.delete({ where: { id } });
      },
      { timeout: 10000 }
    );
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

    const achievement = calcAchievement(kpi);

    return this.prisma.kPI.update({
      where: { id: kpiId },
      data: { actual: achievement },
    });
  }
}
