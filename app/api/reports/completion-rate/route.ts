/**
 * GET /api/reports/completion-rate?granularity=week|month&from=&to=&userId=
 *
 * R-1: Task completion rate report — returns completion rate data points
 * for rendering a line chart (weekly or monthly aggregation).
 *
 * - Manager can see all team members, optionally filter by userId
 * - Member sees only their own tasks
 * - Empty periods return 0% (not omitted)
 *
 * Fixes #836
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import {
  getWeekBounds,
  getCompletionRateData,
  type CompletionRatePoint,
} from "@/lib/completion-rate";

export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);

  const granularity = (searchParams.get("granularity") ?? "month") as "week" | "month";
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const filterUserId = searchParams.get("userId");

  const isManager = session.user.role === "MANAGER";

  // Default range: last 6 months
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const startDate = fromParam ? new Date(fromParam) : defaultFrom;
  const endDate = toParam ? new Date(toParam + "T23:59:59.999Z") : now;

  // Determine user filter
  const userFilter: { primaryAssigneeId?: string } = {};
  if (!isManager) {
    userFilter.primaryAssigneeId = session.user.id;
  } else if (filterUserId) {
    userFilter.primaryAssigneeId = filterUserId;
  }

  const data = await getCompletionRateData(
    prisma,
    startDate,
    endDate,
    granularity,
    userFilter,
  );

  return success({ granularity, from: startDate.toISOString(), to: endDate.toISOString(), data });
});
