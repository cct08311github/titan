import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportSuccess } from "@/lib/report-response";
import { withManager } from "@/lib/auth-middleware";
import { ReportV2Service } from "@/services/report-v2-service";
import { yearSchema, searchParamsToObject } from "@/validators/report-v2-validators";
import { ValidationError } from "@/services/errors";

const svc = new ReportV2Service(prisma);

export const GET = withManager(async (req: NextRequest) => {
  const parsed = yearSchema.safeParse(searchParamsToObject(new URL(req.url).searchParams));
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const year = parsed.data.year;
  const data = await svc.getKPIComposite(year);
  return reportSuccess(data, "kpi-composite", {
    from: `${year}-01-01`,
    to: `${year}-12-31`,
  });
});
