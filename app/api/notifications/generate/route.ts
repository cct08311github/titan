import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { UnauthorizedError } from "@/services/errors";
import { apiHandler } from "@/lib/api-handler";
import { success } from "@/lib/api-response";
import { NotificationService } from "@/services/notification-service";

/**
 * POST /api/notifications/generate
 *
 * Checks tasks and milestones for upcoming due dates / overdue status
 * and creates notification records for assigned users.
 * Skips duplicates where an unread notification of the same type + relatedId
 * already exists for the same user.
 *
 * Intended for use by a cron job or manual invocation.
 */
export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getServerSession();
  if (!session?.user?.id) throw new UnauthorizedError();

  const svc = new NotificationService(prisma);
  const result = await svc.generateAll();

  return success(result);
});
