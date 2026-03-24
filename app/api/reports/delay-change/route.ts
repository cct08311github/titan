import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { ReportService } from "@/services/report-service";

const reportService = new ReportService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const startParam = searchParams.get("startDate");
  const endParam = searchParams.get("endDate");
  const now = new Date();

  const startDate = startParam
    ? new Date(startParam)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate = endParam
    ? new Date(endParam)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const data = await reportService.getDelayChangeReport({
    isManager: true,
    dateRange: { startDate, endDate },
  });

  return success(data);
});
