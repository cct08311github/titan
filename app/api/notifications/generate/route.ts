import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { NotificationService } from "@/services/notification-service";
import { withManager } from "@/lib/auth-middleware";

/**
 * POST /api/notifications/generate
 *
 * Checks tasks and milestones for upcoming due dates / overdue status
 * and creates notification records for assigned users.
 * Skips duplicates where an unread notification of the same type + relatedId
 * already exists for the same user.
 *
 * Intended for use by a cron job or manual invocation.
 * Requires MANAGER role.
 */
export const POST = withManager(async (_req: NextRequest) => {
  const svc = new NotificationService(prisma);
  const result = await svc.generateAll();

  return success(result);
});
