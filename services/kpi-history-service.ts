/**
 * KPIHistoryService — Issue #863
 *
 * Manages KPI actual value history (monthly time series).
 */

import { PrismaClient } from "@prisma/client";

export interface CreateKPIHistoryInput {
  kpiId: string;
  period: string;  // "2026-03"
  actual: number;
  source?: string;
  updatedBy: string;
}

export class KPIHistoryService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Upsert a KPI history entry and sync KPI.actual to latest period value.
   */
  async upsertHistory(input: CreateKPIHistoryInput) {
    const history = await this.prisma.kPIHistory.upsert({
      where: {
        kpiId_period: { kpiId: input.kpiId, period: input.period },
      },
      create: {
        kpiId: input.kpiId,
        period: input.period,
        actual: input.actual,
        source: input.source,
        updatedBy: input.updatedBy,
      },
      update: {
        actual: input.actual,
        source: input.source,
        updatedBy: input.updatedBy,
      },
    });

    // Sync KPI.actual to the latest period's value
    const latest = await this.prisma.kPIHistory.findFirst({
      where: { kpiId: input.kpiId },
      orderBy: { period: "desc" },
    });

    if (latest) {
      await this.prisma.kPI.update({
        where: { id: input.kpiId },
        data: { actual: latest.actual },
      });
    }

    return history;
  }

  /**
   * Get history for a KPI, ordered by period descending.
   */
  async getHistory(kpiId: string) {
    return this.prisma.kPIHistory.findMany({
      where: { kpiId },
      orderBy: { period: "desc" },
      include: { user: { select: { id: true, name: true } } },
    });
  }
}
