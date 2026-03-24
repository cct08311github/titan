import { PrismaClient, TimeCategory } from "@prisma/client";
import { NotFoundError, ValidationError } from "./errors";

export interface ListTimeEntriesFilter {
  userId?: string;
  taskId?: string;
  dateFrom?: Date | string;
  dateTo?: Date | string;
}

export interface CreateTimeEntryInput {
  taskId?: string | null;
  userId: string;
  date: Date | string;
  hours: number;
  category: TimeCategory | string;
  description?: string | null;
}

export interface UpdateTimeEntryInput {
  hours?: number;
  category?: TimeCategory | string;
  description?: string | null;
  date?: Date | string;
}

export interface TimeEntryStats {
  totalHours: number;
  byCategory: Record<string, number>;
}

export class TimeEntryService {
  constructor(private readonly prisma: PrismaClient) {}

  async listTimeEntries(filter: ListTimeEntriesFilter) {
    const where: Record<string, unknown> = {};
    if (filter.userId) where.userId = filter.userId;
    if (filter.taskId) where.taskId = filter.taskId;
    if (filter.dateFrom || filter.dateTo) {
      where.date = {
        ...(filter.dateFrom && { gte: new Date(filter.dateFrom) }),
        ...(filter.dateTo && { lte: new Date(filter.dateTo) }),
      };
    }

    return this.prisma.timeEntry.findMany({
      where,
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
      orderBy: { date: "desc" },
    });
  }

  async createTimeEntry(input: CreateTimeEntryInput) {
    if (!input.userId?.trim()) {
      throw new ValidationError("使用者ID為必填");
    }
    if (!input.hours || input.hours <= 0) {
      throw new ValidationError("工時必須大於 0");
    }

    return this.prisma.timeEntry.create({
      data: {
        taskId: input.taskId ?? null,
        userId: input.userId,
        date: new Date(input.date),
        hours: input.hours,
        category: input.category as TimeCategory,
        description: input.description ?? null,
      },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }

  async updateTimeEntry(id: string, input: UpdateTimeEntryInput) {
    const existing = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

    const updates: Record<string, unknown> = {};
    if (input.hours !== undefined) updates.hours = input.hours;
    if (input.category !== undefined) updates.category = input.category;
    if (input.description !== undefined) updates.description = input.description;
    if (input.date !== undefined) updates.date = new Date(input.date);

    return this.prisma.timeEntry.update({
      where: { id },
      data: updates,
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }

  async deleteTimeEntry(id: string) {
    const existing = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async getStats(filter: ListTimeEntriesFilter): Promise<TimeEntryStats> {
    const entries = await this.listTimeEntries(filter);

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.hours;
      return acc;
    }, {});

    return { totalHours, byCategory };
  }
}
