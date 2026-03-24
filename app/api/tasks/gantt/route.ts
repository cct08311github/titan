import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

export const GET = withAuth(async (req: NextRequest) => {

  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : new Date().getFullYear();
  const assignee = searchParams.get("assignee");

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

  return success({ annualPlan: annualPlan ?? null, year });
});
