/**
 * GET /api/kpi/{id}/history — KPI monthly time series
 * POST /api/kpi/{id}/history — Add/update KPI history entry
 *
 * Issue #863: KPI actual value editing + history
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { KPIHistoryService } from "@/services/kpi-history-service";
import { validateBody } from "@/lib/validate";
import { kpiHistorySchema } from "@/validators/monitoring-validators";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const service = new KPIHistoryService(prisma);

export const GET = withAuth(async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const kpi = await prisma.kPI.findUnique({ where: { id } });
  if (!kpi) {
    return error("NOT_FOUND", "KPI not found", 404);
  }

  const history = await service.getHistory(id);
  return success({ items: history });
});

export const POST = withAuth(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const session = await requireAuth();

  const kpi = await prisma.kPI.findUnique({ where: { id } });
  if (!kpi) {
    return error("NOT_FOUND", "KPI not found", 404);
  }

  const raw = await req.json();
  const body = validateBody(kpiHistorySchema, raw);

  const history = await service.upsertHistory({
    kpiId: id,
    period: body.period,
    actual: body.actual,
    source: body.source,
    updatedBy: session.user.id,
  });

  return success(history, 201);
});
