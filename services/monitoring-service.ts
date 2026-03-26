/**
 * MonitoringService — Issue #863
 *
 * Handles MonitoringAlert lifecycle: webhook ingestion, CRUD, task creation.
 */

import { PrismaClient } from "@prisma/client";

type TransactionClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

export interface WebhookPayload {
  alertName: string;
  severity: string;
  status: "firing" | "resolved";
  labels?: Record<string, unknown>;
  annotations?: { summary?: string; description?: string };
  startsAt: string;
  endsAt?: string;
  source?: string;
}

export class MonitoringService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Process incoming webhook from Grafana/Prometheus.
   * Upserts: if same alertName+startsAt exists, updates status; otherwise creates.
   */
  async processWebhook(payload: WebhookPayload) {
    const startsAt = new Date(payload.startsAt);
    const endsAt = payload.endsAt ? new Date(payload.endsAt) : null;
    const status = payload.status === "resolved" ? "RESOLVED" : "FIRING";
    const source = payload.source ?? "grafana";
    const summary = payload.annotations?.summary ?? payload.alertName;
    const description = payload.annotations?.description ?? null;

    // Upsert: find existing by alertName + startsAt
    const existing = await this.prisma.monitoringAlert.findFirst({
      where: { alertName: payload.alertName, startsAt },
    });

    if (existing) {
      return this.prisma.monitoringAlert.update({
        where: { id: existing.id },
        data: {
          status,
          severity: payload.severity,
          endsAt,
          labels: (payload.labels as Record<string, string>) ?? undefined,
          summary,
          description,
        },
      });
    }

    return this.prisma.monitoringAlert.create({
      data: {
        alertName: payload.alertName,
        severity: payload.severity,
        status,
        source,
        summary,
        description,
        labels: (payload.labels as Record<string, string>) ?? undefined,
        startsAt,
        endsAt,
      },
    });
  }

  /**
   * List alerts, optionally filtered by status.
   */
  async listAlerts(options?: { status?: string; since?: Date }) {
    const where: Record<string, unknown> = {};
    if (options?.status) where.status = options.status;
    if (options?.since) where.startsAt = { gte: options.since };

    return this.prisma.monitoringAlert.findMany({
      where,
      orderBy: { startsAt: "desc" },
      include: { relatedTask: { select: { id: true, title: true, status: true } } },
    });
  }

  /**
   * Acknowledge an alert.
   */
  async acknowledgeAlert(id: string, userId: string) {
    return this.prisma.monitoringAlert.update({
      where: { id },
      data: {
        status: "ACKNOWLEDGED",
        acknowledgedBy: userId,
        acknowledgedAt: new Date(),
      },
    });
  }

  /**
   * Create a Task from an alert and link them.
   */
  async createTaskFromAlert(alertId: string, creatorId: string) {
    const alert = await this.prisma.monitoringAlert.findUnique({ where: { id: alertId } });
    if (!alert) return null;

    return this.prisma.$transaction(async (tx: TransactionClient) => {
      const task = await tx.task.create({
        data: {
          title: `[告警] ${alert.alertName}: ${alert.summary}`,
          description: alert.description ?? `監控告警自動建立：${alert.alertName}\n嚴重等級：${alert.severity}`,
          category: "INCIDENT",
          priority: alert.severity === "critical" ? "P0" : "P1",
          creatorId,
          status: "TODO",
          tags: ["monitoring-alert"],
        },
      });

      await tx.monitoringAlert.update({
        where: { id: alertId },
        data: { relatedTaskId: task.id },
      });

      return task;
    });
  }

  /**
   * Get alert summary for dashboard (last 24h).
   */
  async getDashboardSummary() {
    const since = new Date();
    since.setHours(since.getHours() - 24);

    const alerts = await this.prisma.monitoringAlert.findMany({
      where: { startsAt: { gte: since } },
      orderBy: { startsAt: "desc" },
    });

    const firing = alerts.filter(a => a.status === "FIRING");
    const critical = firing.filter(a => a.severity === "critical").length;
    const warning = firing.filter(a => a.severity === "warning").length;

    return {
      allClear: firing.length === 0,
      critical,
      warning,
      firingAlerts: firing,
      totalLast24h: alerts.length,
    };
  }
}
