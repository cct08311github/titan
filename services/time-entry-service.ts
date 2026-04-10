import { Prisma, PrismaClient, TimeCategory } from "@prisma/client";
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

export interface StartTimerInput {
  userId: string;
  taskId?: string | null;
  category: TimeCategory | string;
  description?: string | null;
}

export interface TimeEntryStats {
  totalHours: number;
  byCategory: Record<string, number>;
}

/** Roles that exist in session.user.role */
export type CallerRole = string;

const READ_ALL_ROLES = new Set(["MANAGER", "ADMIN"]);

/**
 * TS-02: Calculate hours from startTime/endTime, rounded up to nearest 0.25h.
 *
 * Returns null if either argument is null/undefined (fallback to manual hours).
 * Throws if end is before start.
 */
export function calculateHours(
  start: Date | null | undefined,
  end: Date | null | undefined
): number | null {
  if (start == null || end == null) return null;

  const diffMs = end.getTime() - start.getTime();
  if (diffMs < 0) {
    throw new ValidationError("結束時間不能早於開始時間");
  }
  if (diffMs === 0) return 0;

  const diffMinutes = diffMs / (1000 * 60);
  return Math.ceil(diffMinutes / 15) * 0.25;
}

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
      const dateFilter: Record<string, Date> = {};
      if (filter.dateFrom) {
        const fromDate = new Date(filter.dateFrom);
        if (!isNaN(fromDate.getTime())) dateFilter.gte = fromDate;
      }
      if (filter.dateTo) {
        const endDate = new Date(filter.dateTo);
        if (!isNaN(endDate.getTime())) {
          endDate.setHours(23, 59, 59, 999);
          dateFilter.lte = endDate;
        }
      }
      where.date = dateFilter;
    }

    where.isDeleted = false;

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
   *
   * TS-04: Locked entries cannot be updated.
   */
  async updateTimeEntry(
    id: string,
    input: UpdateTimeEntryInput,
    callerId: string,
    callerRole: CallerRole
  ) {
    const existing = await this.prisma.timeEntry.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

    // TS-04: Locked entries cannot be modified
    if ((existing as Record<string, unknown>).locked) {
      throw new ForbiddenError("已鎖定的時間記錄無法修改");
    }

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
   *
   * TS-04: Locked entries cannot be deleted.
   */
  async deleteTimeEntry(id: string, callerId: string, callerRole: CallerRole) {
    const existing = await this.prisma.timeEntry.findFirst({ where: { id, isDeleted: false } });
    if (!existing) throw new NotFoundError(`TimeEntry not found: ${id}`);

    // TS-04: Locked entries cannot be deleted
    if ((existing as Record<string, unknown>).locked) {
      throw new ForbiddenError("已鎖定的時間記錄無法刪除");
    }

    if (existing.userId !== callerId) {
      throw new ForbiddenError("只能刪除自己的時間記錄");
    }

    return this.prisma.timeEntry.delete({ where: { id } });
  }

  /**
   * TS-05: Start a timer for the user.
   * Creates a new entry with isRunning=true, startTime=now.
   * Throws if user already has a running timer.
   */
  async startTimer(input: StartTimerInput) {
    // Check for existing running timer
    const running = await this.prisma.timeEntry.findFirst({
      where: { userId: input.userId, isRunning: true, isDeleted: false },
    });
    if (running) {
      throw new ValidationError("已有計時器正在運行，請先停止後再啟動新的");
    }

    const now = new Date();
    try {
      return await this.prisma.timeEntry.create({
        data: {
          userId: input.userId,
          taskId: input.taskId ?? null,
          category: (input.category as TimeCategory) ?? "PLANNED_TASK",
          description: input.description ?? null,
          date: now,
          hours: 0,
          startTime: now,
          isRunning: true,
        },
        include: {
          task: { select: { id: true, title: true } },
          user: { select: { id: true, name: true } },
        },
      });
    } catch (err) {
      // P2002: unique constraint violation — DB-level guard for concurrent startTimer() calls (Issue #1287)
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002"
      ) {
        throw new ValidationError("您已有一個計時中的工時紀錄");
      }
      throw err;
    }
  }

  /**
   * TS-05: Stop the running timer for the user.
   * Sets endTime=now, calculates hours, sets isRunning=false.
   */
  async stopTimer(userId: string) {
    const running = await this.prisma.timeEntry.findFirst({
      where: { userId, isRunning: true, isDeleted: false },
    });
    if (!running) {
      throw new NotFoundError("沒有正在運行的計時器");
    }

    const endTime = new Date();
    const hours = calculateHours(running.startTime, endTime) ?? 0;

    return this.prisma.timeEntry.update({
      where: { id: running.id },
      data: {
        endTime,
        hours,
        isRunning: false,
      },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    });
  }

  /**
   * TS-05: Get the running timer for a user.
   */
  async getRunningTimer(userId: string) {
    return this.prisma.timeEntry.findFirst({
      where: { userId, isRunning: true, isDeleted: false },
      include: {
        task: { select: { id: true, title: true } },
        user: { select: { id: true, name: true } },
      },
    });
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
