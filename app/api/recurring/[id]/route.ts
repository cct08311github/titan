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
import { requireAuth } from "@/lib/rbac";

const service = new RecurringService(prisma);

export const PATCH = withAuth(async (req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const session = await requireAuth();
  const raw = await req.json();
  const body = validateBody(updateRecurringRuleSchema, raw);

  const existing = await service.getRuleById(id);
  if (!existing) {
    return error("NOT_FOUND", "RecurringRule not found", 404);
  }

  const isOwner = existing.creatorId === session.user.id;
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  if (!isOwner && !isManager) {
    return error("FORBIDDEN", "僅限規則建立者或管理員可操作", 403);
  }

  const rule = await service.updateRule(id, body);
  return success(rule);
});

export const DELETE = withAuth(async (_req: NextRequest, context: { params: Promise<{ id: string }> }) => {
  const { id } = await context.params;
  const session = await requireAuth();

  const existing = await service.getRuleById(id);
  if (!existing) {
    return error("NOT_FOUND", "RecurringRule not found", 404);
  }

  const isOwner = existing.creatorId === session.user.id;
  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";
  if (!isOwner && !isManager) {
    return error("FORBIDDEN", "僅限規則建立者或管理員可操作", 403);
  }

  await service.deleteRule(id);
  return success({ deleted: true });
});
