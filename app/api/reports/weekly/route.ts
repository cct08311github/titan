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
  const dateParam = searchParams.get("date");
  const userIdParam = searchParams.get("userId");
  const refDate = dateParam ? new Date(dateParam) : new Date();
  const isManager = session.user.role === "MANAGER";

  const data = await reportService.getWeeklyReport({
    dateRange: { start: refDate, end: refDate },
    userId: userIdParam ?? (isManager ? undefined : session.user.id),
    isManager,
  });
  return success(data);
});
