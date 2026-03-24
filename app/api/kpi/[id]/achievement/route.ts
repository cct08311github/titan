import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const kpi = await prisma.kPI.findUnique({
      where: { id: params.id },
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

    if (!kpi) {
      return NextResponse.json({ error: "找不到 KPI" }, { status: 404 });
    }

    let achievementRate = 0;
    if (kpi.autoCalc && kpi.taskLinks.length > 0) {
      const totalWeight = kpi.taskLinks.reduce(
        (sum, link) => sum + link.weight,
        0
      );
      const weightedProgress = kpi.taskLinks.reduce((sum, link) => {
        const progress =
          link.task.status === "DONE" ? 100 : link.task.progressPct;
        return sum + (progress * link.weight) / 100;
      }, 0);
      achievementRate =
        totalWeight > 0 ? (weightedProgress / totalWeight) * kpi.target : 0;
    } else {
      achievementRate = kpi.target > 0 ? (kpi.actual / kpi.target) * 100 : 0;
    }

    const linkedTaskCount = kpi.taskLinks.length;
    const completedTaskCount = kpi.taskLinks.filter(
      (l) => l.task.status === "DONE"
    ).length;

    return NextResponse.json({
      kpiId: kpi.id,
      target: kpi.target,
      actual: kpi.actual,
      achievementRate: Math.min(achievementRate, 100),
      linkedTaskCount,
      completedTaskCount,
      autoCalc: kpi.autoCalc,
    });
  } catch (error) {
    console.error("GET /api/kpi/[id]/achievement error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
