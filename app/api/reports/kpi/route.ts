import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { ReportService } from "@/services/report-service";
import { parseYear } from "@/lib/query-params";

const reportService = new ReportService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const year = fromParam
    ? new Date(fromParam).getFullYear()
    : parseYear(searchParams.get("year"));

  const data = await reportService.getKPIReport(year);

  return success(data);
});
