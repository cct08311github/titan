import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session) {
      return NextResponse.json({ error: "未授權" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
    const assignee = searchParams.get("assignee");

    // Fetch annual plan with milestones and monthly goals + tasks
    const annualPlan = await prisma.annualPlan.findUnique({
      where: { year },
      include: {
        milestones: { orderBy: { plannedEnd: "asc" } },
        monthlyGoals: {
          orderBy: { month: "asc" },
          include: {
            tasks: {
              where: assignee
                ? {
                    OR: [
                      { primaryAssigneeId: assignee },
                      { backupAssigneeId: assignee },
                    ],
                  }
                : undefined,
              include: {
                primaryAssignee: { select: { id: true, name: true } },
                backupAssignee: { select: { id: true, name: true } },
              },
              orderBy: [{ priority: "asc" }, { startDate: "asc" }, { dueDate: "asc" }],
            },
          },
        },
      },
    });

    return NextResponse.json({ annualPlan: annualPlan ?? null, year });
  } catch (error) {
    console.error("GET /api/tasks/gantt error:", error);
    return NextResponse.json({ error: "伺服器錯誤" }, { status: 500 });
  }
}
