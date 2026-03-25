/**
 * POST /api/time-entries/stop — Stop the running timer (Issue #713)
 *
 * Sets endTime=now(), calculates hours from startTime→endTime (0.25h minimum unit),
 * and sets isRunning=false.
 * Returns 404 if no timer is currently running.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { NotFoundError } from "@/services/errors";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";

/**
 * Calculate hours between two dates, rounded to nearest 0.25h (15 min).
 * Minimum 0.25h to avoid zero-hour entries.
 */
function calculateHours(start: Date, end: Date): number {
  const diffMs = end.getTime() - start.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  // Round to nearest 0.25h, minimum 0.25h
  const rounded = Math.round(diffHours * 4) / 4;
  return Math.max(0.25, rounded);
}

export const POST = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  // Find the running timer for this user
  const running = await prisma.timeEntry.findFirst({
    where: { userId, isRunning: true },
  });

  if (!running) {
    throw new NotFoundError("目前沒有正在計時的項目");
  }

  const now = new Date();
  const hours = running.startTime
    ? calculateHours(running.startTime, now)
    : 0.25; // Fallback if startTime is somehow null

  const entry = await prisma.timeEntry.update({
    where: { id: running.id },
    data: {
      endTime: now,
      hours,
      isRunning: false,
    },
    include: {
      task: { select: { id: true, title: true, category: true } },
    },
  });

  return success(entry);
});
