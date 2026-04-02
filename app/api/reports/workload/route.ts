import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { ReportService } from "@/services/report-service";

const reportService = new ReportService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("from");
  const endParam = searchParams.get("to");
  const now = new Date();

  const startDate = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const isManager = session.user.role === "MANAGER";

  const data = await reportService.getWorkloadReport({
    isManager,
    userId: session.user.id,
    dateRange: { startDate, endDate },
  });

  return success(data);
});
