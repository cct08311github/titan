import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

/**
 * GET /api/tasks/sla-check — Issue #860
 *
 * Checks all incomplete tasks with slaDeadline in the next 2 hours,
 * creates SLA_EXPIRING notifications (no duplicates).
 */
export const GET = withAuth(async () => {
  const now = new Date();
  const twoHoursLater = new Date(now.getTime() + 2 * 60 * 60 * 1000);

  // Find tasks with slaDeadline in the next 2 hours that are not DONE
  const tasks = await prisma.task.findMany({
    where: {
      slaDeadline: {
        gte: now,
        lte: twoHoursLater,
      },
      status: { not: "DONE" },
      primaryAssigneeId: { not: null },
    },
    select: {
      id: true,
      title: true,
      slaDeadline: true,
      primaryAssigneeId: true,
    },
  });

  let created = 0;

  for (const task of tasks) {
    if (!task.primaryAssigneeId || !task.slaDeadline) continue;

    const remainingMs = task.slaDeadline.getTime() - now.getTime();
    const remainingMin = Math.round(remainingMs / 60000);

    // Check if we already sent a notification for this task recently (within 30 min)
    const recentNotif = await prisma.notification.findFirst({
      where: {
        userId: task.primaryAssigneeId,
        type: "SLA_EXPIRING",
        relatedId: task.id,
        createdAt: { gte: new Date(now.getTime() - 30 * 60 * 1000) },
      },
    });

    if (recentNotif) continue;

    let timeLabel: string;
    if (remainingMin <= 5) timeLabel = "5 分鐘";
    else if (remainingMin <= 30) timeLabel = "30 分鐘";
    else timeLabel = "2 小時";

    await prisma.notification.create({
      data: {
        userId: task.primaryAssigneeId,
        type: "SLA_EXPIRING",
        title: `SLA 即將到期：${task.title}（剩餘 ${timeLabel}）`,
        body: `任務「${task.title}」的 SLA 將於 ${task.slaDeadline.toISOString()} 到期`,
        relatedId: task.id,
        relatedType: "Task",
      },
    });
    created++;
  }

  return success({ checked: tasks.length, notificationsCreated: created });
});
