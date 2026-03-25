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
  const monthParam = searchParams.get("month");
  const userIdParam = searchParams.get("userId");
  const now = new Date();
  const year = monthParam ? parseInt(monthParam.split("-")[0]) : now.getFullYear();
  const month = monthParam ? parseInt(monthParam.split("-")[1]) : now.getMonth() + 1;
  const isManager = session.user.role === "MANAGER";

  const data = await reportService.getMonthlyReport({
    year, month,
    userId: userIdParam ?? (isManager ? undefined : session.user.id),
    isManager,
  });
  return success(data);
});
