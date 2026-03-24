import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

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

  let achievementRate = 0;
  if (kpi.autoCalc && kpi.taskLinks.length > 0) {
    const totalWeight = kpi.taskLinks.reduce((sum, link) => sum + link.weight, 0);
    const weightedProgress = kpi.taskLinks.reduce((sum, link) => {
      const progress = link.task.status === "DONE" ? 100 : link.task.progressPct;
      return sum + (progress * link.weight) / 100;
    }, 0);
    achievementRate = totalWeight > 0 ? (weightedProgress / totalWeight) * kpi.target : 0;
  } else {
    achievementRate = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0;
  }

  const linkedTaskCount = kpi.taskLinks.length;
  const completedTaskCount = kpi.taskLinks.filter((l) => l.task.status === "DONE").length;

  return success({
    kpiId: kpi.id,
    target: kpi.target,
    actual: kpi.actual,
    achievementRate: Math.min(achievementRate, 100),
    linkedTaskCount,
    completedTaskCount,
    autoCalc: kpi.autoCalc,
  });
});
