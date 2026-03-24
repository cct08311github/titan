import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateBody } from "@/lib/validate";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { ChangeTrackingService } from "@/services/change-tracking-service";
import { requireAuth } from "@/lib/rbac";

const createTaskChangeSchema = z.object({
  changeType: z.enum(["DELAY", "SCOPE_CHANGE"]),
  reason: z.string().min(1),
  oldValue: z.string().optional(),
  newValue: z.string().optional(),
});

const changeTracker = new ChangeTrackingService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const changes = await changeTracker.getChangeHistory(id);
  const delayCount = changes.filter((c) => c.changeType === "DELAY").length;
  const scopeChangeCount = changes.filter((c) => c.changeType === "SCOPE_CHANGE").length;

  return success({ changes, delayCount, scopeChangeCount });
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const { changeType, reason, oldValue, newValue } = validateBody(createTaskChangeSchema, raw);

  const change = await prisma.taskChange.create({
    data: {
      taskId: id,
      changeType,
      reason,
      oldValue: oldValue || null,
      newValue: newValue || null,
      changedBy: session.user.id,
    },
    include: {
      changedByUser: { select: { id: true, name: true } },
    },
  });

  return success(change, 201);
});
