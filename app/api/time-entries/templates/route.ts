/**
 * GET / POST /api/time-entries/templates — Time entry templates (TS-30)
 *
 * Users can save common time entry patterns as templates for quick fill.
 * Max 10 templates per user.
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { validateBody } from "@/lib/validate";
import { success } from "@/lib/api-response";
import { ValidationError } from "@/services/errors";
import { TimeCategoryEnum } from "@/validators/shared/enums";

const templateEntrySchema = z.object({
  hours: z.number().min(0).max(24),
  category: TimeCategoryEnum.optional().default("PLANNED_TASK"),
  taskId: z.string().optional(),
  description: z.string().optional(),
});

const createTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  entries: z.array(templateEntrySchema).min(1).max(20),
});

export const GET = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();

  const templates = await prisma.timeEntryTemplate.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return success(templates);
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const raw = await req.json();
  const { name, entries } = validateBody(createTemplateSchema, raw);

  // Enforce max 10 templates per user
  const count = await prisma.timeEntryTemplate.count({ where: { userId } });
  if (count >= 10) {
    throw new ValidationError("每位使用者最多 10 個模板");
  }

  const template = await prisma.timeEntryTemplate.create({
    data: {
      name,
      userId,
      entries: JSON.stringify(entries),
    },
  });

  return success(template, 201);
});
