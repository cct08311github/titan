import { PrismaClient, TimeCategory } from "@prisma/client";
import { ForbiddenError, NotFoundError, ValidationError } from "./errors";

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
  taskId?: string | null;
  hours?: number;
  category?: TimeCategory | string;
  description?: string | null;
  date?: Date | string;
}

export interface TimeEntryStats {
  totalHours: number;
  byCategory: Record<string, number>;
}

/** Roles that exist in session.user.role */
export type CallerRole = string;

const READ_ALL_ROLES = new Set(["MANAGER", "ADMIN"]);

export class TimeEntryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * List time entries.
   *
   * IDOR rules:
   * - MANAGER / ADMIN: may query any userId (read exemption).
   * - All other roles: query is always scoped to callerId regardless of
   *   what userId was passed in filter. Passing a different userId → 403.
   */
  async listTimeEntries(
    filter: ListTimeEntriesFilter,
    callerId: string,
    callerRole: CallerRole
  ) {
    const canReadAll = READ_ALL_ROLES.has(callerRole);

    // If a specific foreign userId was requested and the caller has no
    // read-all privilege, that is an IDOR attempt → 403.
    if (!canReadAll && filter.userId && filter.userId !== callerId) {
      throw new ForbiddenError("其他使用者的時間記錄無法存取");
    }

    const where: Record<string, unknown> = {};

    // Non-privileged callers are always scoped to themselves.
    if (!canReadAll) {
      where.userId = callerId;
    } else if (filter.userId) {
      where.userId = filter.userId;
    }

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

  /**
   * Create a time entry.
   *
   * The API layer always passes session.user.id as userId, so no extra
   * ownership check is needed here — validation guards against empty/bad input.
   */
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

  /**
   * Update a time entry.
   *
   * IDOR rules:
   * - All roles (including MANAGER): must own the entry to write.
   *   → Single query fetches the entry; ownership check in the same round-trip.
   */
  async updateTimeEntry(
    id: string,
    input: UpdateTimeEntryInput,
    callerId: string,
    callerRole: CallerRole
  ) {
    const existing = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

    // Write is always restricted to the owner regardless of role.
    if (existing.userId !== callerId) {
      throw new ForbiddenError("只能修改自己的時間記錄");
    }

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

  /**
   * Delete a time entry.
   *
   * IDOR rules:
   * - All roles (including MANAGER): must own the entry to delete.
   */
  async deleteTimeEntry(id: string, callerId: string, callerRole: CallerRole) {
    const existing = await this.prisma.timeEntry.findUnique({ where: { id } });
    if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

    if (existing.userId !== callerId) {
      throw new ForbiddenError("只能刪除自己的時間記錄");
    }

    return this.prisma.timeEntry.delete({ where: { id } });
  }

  async getStats(
    filter: ListTimeEntriesFilter,
    callerId: string,
    callerRole: CallerRole
  ): Promise<TimeEntryStats> {
    const entries = await this.listTimeEntries(filter, callerId, callerRole);

    const totalHours = entries.reduce((sum, e) => sum + e.hours, 0);
    const byCategory = entries.reduce<Record<string, number>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.hours;
      return acc;
    }, {});

    return { totalHours, byCategory };
  }
}
