/**
 * GET /api/recurring — List all recurring rules
 * POST /api/recurring — Create a new recurring rule
 *
 * Issue #862: Recurring Tasks
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecurringService } from "@/services/recurring-service";
import { validateBody } from "@/lib/validate";
import { createRecurringRuleSchema } from "@/validators/recurring-validators";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const service = new RecurringService(prisma);

export const GET = withAuth(async (_req: NextRequest) => {
  const rules = await service.listRules();
  return success({ items: rules });
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const body = validateBody(createRecurringRuleSchema, raw);

  const rule = await service.createRule({
    ...body,
    creatorId: session.user.id,
  });

  return success(rule, 201);
});
