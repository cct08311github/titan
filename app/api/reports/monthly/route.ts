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
  const monthParam = searchParams.get("month"); // format: "2026-03"
  const now = new Date();
  const year = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.split("-")[1]) : now.getMonth() + 1;

  const view = searchParams.get("view"); // "pivot" for pivot table (Issue #832)
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";

  if (view === "pivot") {
    const data = await reportService.getMonthlyPivot({
      isManager,
      userId: session.user.id,
      year,
      month,
    });
    return success(data);
  }

  const data = await reportService.getMonthlyReport({
    isManager,
    userId: session.user.id,
    year,
    month,
  });

  return success(data);
});
