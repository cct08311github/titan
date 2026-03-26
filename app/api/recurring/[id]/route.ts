/**
 * PATCH /api/recurring/{id} — Update recurring rule (including activate/deactivate)
 * DELETE /api/recurring/{id} — Delete recurring rule
 *
 * Issue #862: Recurring Tasks
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecurringService } from "@/services/recurring-service";
import { validateBody } from "@/lib/validate";
import { updateRecurringRuleSchema } from "@/validators/recurring-validators";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

const service = new RecurringService(prisma);

export const PATCH = withAuth(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateRecurringRuleSchema, raw);

  const rule = await service.updateRule(id, body);
  if (!rule) {
    return error("NOT_FOUND", "RecurringRule not found", 404);
  }

  return success(rule);
});

export const DELETE = withAuth(async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;

  const existing = await service.getRuleById(id);
  if (!existing) {
    return error("NOT_FOUND", "RecurringRule not found", 404);
  }

  await service.deleteRule(id);
  return success({ deleted: true });
});
