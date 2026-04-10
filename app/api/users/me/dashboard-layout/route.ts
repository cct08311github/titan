/**
 * GET  /api/users/me/dashboard-layout — 取得儀表板 Widget 排列設定
 * PUT  /api/users/me/dashboard-layout — 更新儀表板 Widget 排列設定
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

const WidgetSettingSchema = z.object({
  id: z.string(),
  visible: z.boolean(),
});

const DashboardLayoutSchema = z.array(WidgetSettingSchema).max(50);

export const GET = withAuth(async (_req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { dashboardLayout: true },
  });

  if (!user) {
    return error("NotFoundError", "使用者不存在", 404);
  }

  return success({ layout: user.dashboardLayout });
});

export const PUT = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的 JSON 格式", 400);
  }

  const parsed = DashboardLayoutSchema.safeParse(body);
  if (!parsed.success) {
    return error("ValidationError", parsed.error.issues[0]?.message ?? "資料驗證失敗", 400);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data: { dashboardLayout: parsed.data as unknown as Prisma.InputJsonValue },
    select: { dashboardLayout: true },
  });

  return success({ layout: updated.dashboardLayout });
});
