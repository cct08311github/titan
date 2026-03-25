import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { calculateAchievement, calculateAvgAchievement } from "@/lib/kpi-calculator";

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

  const kpisWithAchievement = kpis.map((kpi) => ({
    ...kpi,
    achievementRate: calculateAchievement(kpi),
  }));

  const rates = kpisWithAchievement.map((k) => k.achievementRate);
  const avgAchievement = calculateAvgAchievement(rates);

  return success({
    year,
    kpis: kpisWithAchievement,
    avgAchievement,
    achievedCount: kpisWithAchievement.filter((k) => k.achievementRate >= 100).length,
    totalCount: kpisWithAchievement.length,
  });
});
