import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { calculateAchievement } from "@/lib/kpi-calculator";

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {

  const { id } = await context.params;
  const kpi = await prisma.kPI.findUnique({
    where: { id },
    include: {
      taskLinks: {
        include: {
          task: {
            select: {
              id: true,
              title: true,
              status: true,
              progressPct: true,
              estimatedHours: true,
              actualHours: true,
            },
          },
        },
      },
    },
  });

  if (!kpi) throw new NotFoundError("找不到 KPI");

  const achievementRate = calculateAchievement(kpi);

  const linkedTaskCount = kpi.taskLinks.length;
  const completedTaskCount = kpi.taskLinks.filter((l) => l.task.status === "DONE").length;

  return success({
    kpiId: kpi.id,
    target: kpi.target,
    actual: kpi.actual,
    achievementRate,
    linkedTaskCount,
    completedTaskCount,
    autoCalc: kpi.autoCalc,
  });
});
