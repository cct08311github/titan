/**
 * PATCH /api/monitoring-alerts/{id} — Update alert (acknowledge / link task)
 *
 * Issue #863: External Monitoring Integration
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { MonitoringService } from "@/services/monitoring-service";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const service = new MonitoringService(prisma);

export const PATCH = withAuth(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const session = await requireAuth();
  const raw = await req.json();

  if (raw.action === "acknowledge") {
    if (session.user.role !== "MANAGER" && session.user.role !== "ADMIN") {
      return error("FORBIDDEN", "僅限管理員可確認警報", 403);
    }
    const alert = await service.acknowledgeAlert(id, session.user.id);
    return success(alert);
  }

  if (raw.action === "create_task") {
    const task = await service.createTaskFromAlert(id, session.user.id);
    if (!task) {
      return error("NOT_FOUND", "Alert not found", 404);
    }
    return success(task, 201);
  }

  return error("BAD_REQUEST", "Invalid action. Use 'acknowledge' or 'create_task'", 400);
});
