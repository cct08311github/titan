import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { reportSuccess } from "@/lib/report-response";
import { withManager } from "@/lib/auth-middleware";
import { ReportV2Service } from "@/services/report-v2-service";
import { earnedValueSchema, searchParamsToObject } from "@/validators/report-v2-validators";
import { ValidationError, NotFoundError } from "@/services/errors";

const svc = new ReportV2Service(prisma);

export const GET = withManager(async (req: NextRequest) => {
  const parsed = earnedValueSchema.safeParse(searchParamsToObject(new URL(req.url).searchParams));
  if (!parsed.success) throw new ValidationError(parsed.error.issues[0].message);
  const data = await svc.getEarnedValue(parsed.data.planId, parsed.data.asOfDate);
  if (!data) throw new NotFoundError("計畫不存在");
  return reportSuccess(data, "earned-value", {
    from: parsed.data.asOfDate,
    to: parsed.data.asOfDate,
  });
});
