/**
 * GET  /api/users/me/filters — 取得目前使用者的儲存篩選條件
 * POST /api/users/me/filters — 取代整組儲存篩選條件
 *
 * Issue #1325: Saved Filters
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

const SavedFilterSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(50),
  scope: z.enum(["kanban", "timesheet", "plans"]),
  filters: z.record(z.string(), z.unknown()),
  createdAt: z.string().datetime(),
});

const SavedFiltersArraySchema = z.array(SavedFilterSchema).max(20);

export const GET = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { savedFilters: true },
  });

  if (!user) {
    return error("NotFoundError", "使用者不存在", 404);
  }

  return success({ filters: user.savedFilters });
});

export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的 JSON 格式", 400);
  }

  const parsed = SavedFiltersArraySchema.safeParse(body);
  if (!parsed.success) {
    return error("ValidationError", parsed.error.issues[0]?.message ?? "資料驗證失敗", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { savedFilters: parsed.data as unknown as Prisma.InputJsonValue },
    select: { savedFilters: true },
  });

  return success({ filters: updated.savedFilters });
});
