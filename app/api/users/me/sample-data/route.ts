/**
 * DELETE /api/users/me/sample-data — Issue #1317
 *
 * Removes all sample data records belonging to the current user.
 * Allows users to clean up tutorial data once they start real work.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { logger } from "@/lib/logger";

export const DELETE = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  // Delete sample tasks created by this user
  const deletedTasks = await prisma.task.deleteMany({
    where: {
      isSample: true,
      creatorId: userId,
    },
  });

  // Delete sample annual plans created by this user
  const deletedPlans = await prisma.annualPlan.deleteMany({
    where: {
      isSample: true,
      createdBy: userId,
    },
  });

  logger.info(
    { userId, deletedTasks: deletedTasks.count, deletedPlans: deletedPlans.count },
    "[sample-data] Sample data deleted"
  );

  return success({
    deleted: {
      tasks: deletedTasks.count,
      plans: deletedPlans.count,
    },
  });
});
