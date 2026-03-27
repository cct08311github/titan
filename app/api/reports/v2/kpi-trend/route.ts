import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { ReportV2Service } from "@/services/report-v2-service";
import { kpiTrendSchema, searchParamsToObject } from "@/validators/report-v2-validators";
import { ValidationError } from "@/services/errors";

const svc = new ReportV2Service(prisma);

export const GET = withManager(async (req: NextRequest) => {
  const parsed = kpiTrendSchema.safeParse(searchParamsToObject(new URL(req.url).searchParams));
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const data = await svc.getKPITrend(parsed.data.year, parsed.data.kpiId);
  return success(data);
});
