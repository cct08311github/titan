import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { parseYear } from "@/lib/query-params";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  const { searchParams } = new URL(req.url);
  const year = parseYear(searchParams.get("year"));
  // Issue #1257: ENGINEER role must only see own tasks in gantt
  const assignee = session.user.role === "ENGINEER"
    ? session.user.id
    : searchParams.get("assignee");

  const annualPlan = await prisma.annualPlan.findFirst({
    where: { year, archivedAt: null },
    orderBy: [{ monthlyGoals: { _count: "desc" } }, { createdAt: "desc" }],
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
            take: 500,
          },
        },
      },
    },
  });

  return success({ annualPlan: annualPlan ?? null, year });
});
