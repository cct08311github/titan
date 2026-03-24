import { PrismaClient } from "@prisma/client";

export interface DetectDelayInput {
  taskId: string;
  oldDueDate: Date | null;
  newDueDate: Date | null;
  changedBy: string;
  reason?: string;
}

export interface DetectScopeChangeInput {
  taskId: string;
  oldTitle: string;
  newTitle: string;
  oldDescription: string | null;
  newDescription: string | null;
  changedBy: string;
  reason?: string;
}

export interface DateRangeFilter {
  start: Date;
  end: Date;
  taskId?: string;
}

const TITLE_SIGNIFICANT_CHANGE_THRESHOLD = 0.4; // 40% difference ratio

function isTitleSignificantlyChanged(oldTitle: string, newTitle: string): boolean {
  if (oldTitle === newTitle) return false;
  const maxLen = Math.max(oldTitle.length, newTitle.length);
  if (maxLen === 0) return false;
  // Use simple character-level difference heuristic
  const minLen = Math.min(oldTitle.length, newTitle.length);
  let commonChars = 0;
  for (let i = 0; i < minLen; i++) {
    if (oldTitle[i] === newTitle[i]) commonChars++;
  }
  const similarity = commonChars / maxLen;
  return similarity < (1 - TITLE_SIGNIFICANT_CHANGE_THRESHOLD);
}

export class ChangeTrackingService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Detects if a dueDate change represents a delay (new date is later than old date).
   * Creates a DELAY TaskChange record if so.
   */
  async detectDelay(input: DetectDelayInput) {
    const { taskId, oldDueDate, newDueDate, changedBy, reason } = input;

    // No change or not a delay (new date not later than old date)
    if (!oldDueDate || !newDueDate) return null;
    if (newDueDate.getTime() <= oldDueDate.getTime()) return null;

    return this.prisma.$transaction(
      async (tx) => {
        return tx.taskChange.create({
          data: {
            taskId,
            changeType: "DELAY",
            reason: reason ?? "Due date extended",
            oldValue: oldDueDate.toISOString(),
            newValue: newDueDate.toISOString(),
            changedBy,
          },
          include: {
            changedByUser: { select: { id: true, name: true } },
          },
        });
      },
      { timeout: 10000 }
    );
  }

  /**
   * Detects if a title or description change represents a scope change.
   * Creates a SCOPE_CHANGE TaskChange record if so.
   */
  async detectScopeChange(input: DetectScopeChangeInput) {
    const { taskId, oldTitle, newTitle, oldDescription, newDescription, changedBy, reason } = input;

    const titleChanged = isTitleSignificantlyChanged(oldTitle ?? "", newTitle ?? "");
    const descriptionChanged =
      (oldDescription ?? "") !== (newDescription ?? "");

    if (!titleChanged && !descriptionChanged) return null;

    const oldValue = titleChanged ? oldTitle : (oldDescription ?? "");
    const newValue = titleChanged ? newTitle : (newDescription ?? "");

    return this.prisma.$transaction(
      async (tx) => {
        return tx.taskChange.create({
          data: {
            taskId,
            changeType: "SCOPE_CHANGE",
            reason: reason ?? "Scope changed",
            oldValue,
            newValue,
            changedBy,
          },
          include: {
            changedByUser: { select: { id: true, name: true } },
          },
        });
      },
      { timeout: 10000 }
    );
  }

  /**
   * Atomically detects and records both delay and scope-change within one transaction.
   * Use this when updating a task to ensure all change records are written together.
   */
  async detectAndRecordAll(
    delayInput: DetectDelayInput | null,
    scopeInput: DetectScopeChangeInput | null
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const results: unknown[] = [];

        if (delayInput) {
          const { taskId, oldDueDate, newDueDate, changedBy, reason } = delayInput;
          if (oldDueDate && newDueDate && newDueDate.getTime() > oldDueDate.getTime()) {
            const record = await tx.taskChange.create({
              data: {
                taskId,
                changeType: "DELAY",
                reason: reason ?? "Due date extended",
                oldValue: oldDueDate.toISOString(),
                newValue: newDueDate.toISOString(),
                changedBy,
              },
              include: { changedByUser: { select: { id: true, name: true } } },
            });
            results.push(record);
          }
        }

        if (scopeInput) {
          const { taskId, oldTitle, newTitle, oldDescription, newDescription, changedBy, reason } = scopeInput;
          const titleChanged = isTitleSignificantlyChanged(oldTitle ?? "", newTitle ?? "");
          const descriptionChanged = (oldDescription ?? "") !== (newDescription ?? "");

          if (titleChanged || descriptionChanged) {
            const oldValue = titleChanged ? oldTitle : (oldDescription ?? "");
            const newValue = titleChanged ? newTitle : (newDescription ?? "");
            const record = await tx.taskChange.create({
              data: {
                taskId,
                changeType: "SCOPE_CHANGE",
                reason: reason ?? "Scope changed",
                oldValue,
                newValue,
                changedBy,
              },
              include: { changedByUser: { select: { id: true, name: true } } },
            });
            results.push(record);
          }
        }

        return results;
      },
      { timeout: 10000 }
    );
  }

  /**
   * Returns all change history for a task, ordered by most recent first.
   */
  async getChangeHistory(taskId: string) {
    return this.prisma.taskChange.findMany({
      where: { taskId },
      include: {
        changedByUser: { select: { id: true, name: true } },
      },
      orderBy: { changedAt: "desc" },
    });
  }

  /**
   * Returns the count of DELAY records within a date range.
   */
  async getDelayCount(filter: DateRangeFilter): Promise<number> {
    const where: Record<string, unknown> = {
      changeType: "DELAY",
      changedAt: { gte: filter.start, lte: filter.end },
    };
    if (filter.taskId) where.taskId = filter.taskId;

    return this.prisma.taskChange.count({ where });
  }

  /**
   * Returns the count of SCOPE_CHANGE records within a date range.
   */
  async getChangeCount(filter: DateRangeFilter): Promise<number> {
    const where: Record<string, unknown> = {
      changeType: "SCOPE_CHANGE",
      changedAt: { gte: filter.start, lte: filter.end },
    };
    if (filter.taskId) where.taskId = filter.taskId;

    return this.prisma.taskChange.count({ where });
  }
}
