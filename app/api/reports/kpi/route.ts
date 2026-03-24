import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

export const GET = withAuth(async (req: NextRequest) => {

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year")
    ? parseInt(searchParams.get("year")!)
    : new Date().getFullYear();

  const kpis = await prisma.kPI.findMany({
    where: { year },
    include: {
      taskLinks: {
        include: {
          task: {
            select: { id: true, title: true, status: true, progressPct: true },
          },
        },
      },
    },
    orderBy: { code: "asc" },
  });

  const kpisWithAchievement = kpis.map((kpi) => {
    let achievementRate = 0;
    if (kpi.autoCalc && kpi.taskLinks.length > 0) {
      const totalWeight = kpi.taskLinks.reduce((sum, l) => sum + l.weight, 0);
      const weighted = kpi.taskLinks.reduce((sum, l) => {
        const prog = l.task.status === "DONE" ? 100 : l.task.progressPct;
        return sum + (prog * l.weight) / 100;
      }, 0);
      achievementRate = totalWeight > 0 ? (weighted / totalWeight) * kpi.target : 0;
    } else {
      achievementRate = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0;
    }
    return { ...kpi, achievementRate: Math.min(achievementRate, 100) };
  });

  const avgAchievement =
    kpisWithAchievement.length > 0
      ? kpisWithAchievement.reduce((s, k) => s + k.achievementRate, 0) / kpisWithAchievement.length
      : 0;

  return success({
    year,
    kpis: kpisWithAchievement,
    avgAchievement: Math.round(avgAchievement * 10) / 10,
    achievedCount: kpisWithAchievement.filter((k) => k.achievementRate >= 100).length,
    totalCount: kpisWithAchievement.length,
  });
});
