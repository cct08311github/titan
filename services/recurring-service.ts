/**
 * RecurringService — Issue #862
 *
 * Manages RecurringRule CRUD and automatic Task generation.
 */

import { PrismaClient, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
import {
  calculateNextDueAt,
  resolveTitle,
  shouldGenerate,
  RecurringSchedule,
} from "@/lib/recurring-utils";

export interface CreateRecurringRuleInput {
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  assigneeId?: string;
  templateId?: string;
  frequency: string;
  dayOfWeek?: number;
  dayOfMonth?: number;
  monthOfYear?: number;
  timeOfDay?: string;
  estimatedHours?: number;
  creatorId: string;
}

export interface UpdateRecurringRuleInput {
  title?: string;
  description?: string | null;
  category?: string;
  priority?: string;
  assigneeId?: string | null;
  frequency?: string;
  dayOfWeek?: number | null;
  dayOfMonth?: number | null;
  monthOfYear?: number | null;
  timeOfDay?: string | null;
  estimatedHours?: number | null;
  isActive?: boolean;
}

export class RecurringService {
  constructor(private readonly prisma: PrismaClient) {}

  async listRules() {
    return this.prisma.recurringRule.findMany({
      orderBy: { createdAt: "desc" },
      include: { creator: { select: { id: true, name: true } } },
    });
  }

  async getRuleById(id: string) {
    return this.prisma.recurringRule.findUnique({
      where: { id },
      include: { creator: { select: { id: true, name: true } } },
    });
  }

  async createRule(input: CreateRecurringRuleInput) {
    const schedule: RecurringSchedule = {
      frequency: input.frequency as RecurringSchedule["frequency"],
      dayOfWeek: input.dayOfWeek,
      dayOfMonth: input.dayOfMonth,
      monthOfYear: input.monthOfYear,
      timeOfDay: input.timeOfDay,
    };

    // Calculate first nextDueAt from now
    const now = new Date();
    const nextDueAt = calculateNextDueAt(schedule, now);

    return this.prisma.recurringRule.create({
      data: {
        title: input.title,
        description: input.description,
        category: (input.category as "ADMIN") ?? "ADMIN",
        priority: (input.priority as "P2") ?? "P2",
        assigneeId: input.assigneeId,
        templateId: input.templateId,
        frequency: input.frequency as "DAILY",
        dayOfWeek: input.dayOfWeek,
        dayOfMonth: input.dayOfMonth,
        monthOfYear: input.monthOfYear,
        timeOfDay: input.timeOfDay,
        estimatedHours: input.estimatedHours,
        creatorId: input.creatorId,
        nextDueAt,
      },
    });
  }

  async updateRule(id: string, input: UpdateRecurringRuleInput) {
    // If frequency or schedule params changed, recalculate nextDueAt
    const existing = await this.prisma.recurringRule.findUnique({ where: { id } });
    if (!existing) return null;

    const frequency = (input.frequency ?? existing.frequency) as RecurringSchedule["frequency"];
    const schedule: RecurringSchedule = {
      frequency,
      dayOfWeek: input.dayOfWeek !== undefined ? input.dayOfWeek : existing.dayOfWeek,
      dayOfMonth: input.dayOfMonth !== undefined ? input.dayOfMonth : existing.dayOfMonth,
      monthOfYear: input.monthOfYear !== undefined ? input.monthOfYear : existing.monthOfYear,
      timeOfDay: input.timeOfDay !== undefined ? input.timeOfDay : existing.timeOfDay,
    };

    const needsRecalc =
      input.frequency !== undefined ||
      input.dayOfWeek !== undefined ||
      input.dayOfMonth !== undefined ||
      input.monthOfYear !== undefined ||
      input.timeOfDay !== undefined;

    const nextDueAt = needsRecalc
      ? calculateNextDueAt(schedule, new Date())
      : undefined;

    return this.prisma.recurringRule.update({
      where: { id },
      data: {
        ...input,
        category: input.category as "ADMIN" | undefined,
        priority: input.priority as "P2" | undefined,
        frequency: input.frequency as "DAILY" | undefined,
        ...(nextDueAt !== undefined ? { nextDueAt } : {}),
      },
    });
  }

  async deleteRule(id: string) {
    return this.prisma.recurringRule.delete({ where: { id } });
  }

  /**
   * Generate tasks for all active recurring rules whose nextDueAt <= now.
   * Idempotent: uses lastGeneratedAt + nextDueAt to prevent duplicates.
   *
   * @param now         Reference time (defaults to current time)
   * @param maxBackfillDays  Skip rules whose nextDueAt is older than this many days
   *                        to prevent generating thousands of tasks after a long outage.
   *                        Defaults to 7.
   *
   * Returns count of tasks created.
   */
  async generateTasks(
    now: Date = new Date(),
    maxBackfillDays = 7
  ): Promise<{
    generated: number;
    rules: Array<{ ruleId: string; taskId: string; title: string }>;
  }> {
    const backfillCutoff = new Date(
      now.getTime() - maxBackfillDays * 24 * 60 * 60 * 1000
    );

    const dueRules = await this.prisma.recurringRule.findMany({
      where: {
        isActive: true,
        nextDueAt: {
          lte: now,
          gte: backfillCutoff, // skip rules overdue by more than maxBackfillDays
        },
      },
    });

    // Count and warn about rules skipped due to age
    const skipped = await this.prisma.recurringRule.count({
      where: {
        isActive: true,
        nextDueAt: { lt: backfillCutoff },
      },
    });

    if (skipped > 0) {
      logger.warn(
        {
          skipped,
          backfillCutoff: backfillCutoff.toISOString(),
          event: "recurring_skip_old",
        },
        `Skipping ${skipped} very old recurring rules (nextDueAt < ${backfillCutoff.toISOString()})`
      );
    }

    const results: Array<{ ruleId: string; taskId: string; title: string }> = [];

    for (const rule of dueRules) {
      if (!shouldGenerate(rule, now)) continue;

      const title = resolveTitle(rule.title, now);

      // Use transaction for atomicity
      const result = await this.prisma.$transaction(async (tx: TransactionClient) => {
        // Create the task
        const task = await tx.task.create({
          data: {
            title,
            description: rule.description,
            category: rule.category,
            priority: rule.priority,
            primaryAssigneeId: rule.assigneeId,
            creatorId: rule.creatorId,
            estimatedHours: rule.estimatedHours,
            tags: ["recurring"],
            status: "TODO",
          },
        });

        // Calculate next due
        const schedule: RecurringSchedule = {
          frequency: rule.frequency,
          dayOfWeek: rule.dayOfWeek,
          dayOfMonth: rule.dayOfMonth,
          monthOfYear: rule.monthOfYear,
          timeOfDay: rule.timeOfDay,
        };
        const nextDueAt = calculateNextDueAt(schedule, now);

        // Update rule
        await tx.recurringRule.update({
          where: { id: rule.id },
          data: {
            lastGeneratedAt: now,
            nextDueAt,
          },
        });

        return { ruleId: rule.id, taskId: task.id, title: task.title };
      });

      results.push(result);
    }

    return { generated: results.length, rules: results };
  }
}
