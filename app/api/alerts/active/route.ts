/**
 * GET /api/alerts/active — Issue #986
 *
 * Returns active system alerts for managers.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { AlertService } from "@/services/alert-service";

const alertService = new AlertService(prisma);

export const GET = withManager(async (_req: NextRequest) => {
  const alerts = await alertService.getActiveAlerts();
  return success({ alerts });
});
