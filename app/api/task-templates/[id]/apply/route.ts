import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { NotFoundError } from "@/services/errors";
import { z } from "zod";
import { validateBody } from "@/lib/validate";

/**
 * Optional overrides when applying a template to create a task.
 */
const applyTemplateSchema = z.object({
  primaryAssigneeId: z.string().optional(),
  backupAssigneeId: z.string().optional(),
  monthlyGoalId: z.string().optional(),
  dueDate: z.string().datetime().optional(),
  startDate: z.string().datetime().optional(),
});

/**
 * POST /api/task-templates/[id]/apply
 * Creates a new task based on the template, with optional overrides.
 */
export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  const template = await prisma.taskTemplate.findUnique({
    where: { id },
  });

  if (!template) {
    throw new NotFoundError("任務模板不存在");
  }

  const raw = await req.json();
  const overrides = validateBody(applyTemplateSchema, raw);

  const task = await prisma.task.create({
    data: {
      title: template.title,
      description: template.description,
      priority: template.priority,
      category: template.category,
      estimatedHours: template.estimatedHours,
      creatorId: session.user.id,
      status: "BACKLOG",
      ...(overrides.primaryAssigneeId && { primaryAssigneeId: overrides.primaryAssigneeId }),
      ...(overrides.backupAssigneeId && { backupAssigneeId: overrides.backupAssigneeId }),
      ...(overrides.monthlyGoalId && { monthlyGoalId: overrides.monthlyGoalId }),
      ...(overrides.dueDate && { dueDate: new Date(overrides.dueDate) }),
      ...(overrides.startDate && { startDate: new Date(overrides.startDate) }),
    },
    include: {
      primaryAssignee: { select: { id: true, name: true } },
      backupAssignee: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
  });

  return success(task, 201);
});
