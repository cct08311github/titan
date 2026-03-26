/**
 * GET /api/monitoring-alerts — List monitoring alerts
 *
 * Query params: status (FIRING|RESOLVED|ACKNOWLEDGED), since (ISO date)
 *
 * Issue #863: External Monitoring Integration
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MonitoringService } from "@/services/monitoring-service";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

const service = new MonitoringService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;
  const sinceParam = searchParams.get("since");
  const since = sinceParam ? new Date(sinceParam) : undefined;

  const alerts = await service.listAlerts({ status, since });
  return success({ items: alerts });
});
