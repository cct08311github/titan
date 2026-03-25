/**
 * GET /api/time-entries/running — Get current running timer (Issue #714)
 *
 * Returns the user's currently running TimeEntry, or null if none.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

export const GET = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const running = await prisma.timeEntry.findFirst({
    where: { userId, isRunning: true },
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
  });

  return success(running);
});
