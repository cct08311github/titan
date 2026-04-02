/**
 * GET /api/reports/login-activity — Issue #1161
 * Login success/failure counts by user.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManagerOrAbove as requireManager } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

export async function GET(req: NextRequest) {
  try { await requireManager(); } catch { return error("ForbiddenError", "僅限管理員", 403); }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const dateFilter: Record<string, unknown> = {};
  if (from) dateFilter.gte = new Date(from);
  if (to) dateFilter.lte = new Date(to);

  const logs = await prisma.auditLog.findMany({
    where: {
      action: { in: ["LOGIN_SUCCESS", "LOGIN_FAILURE", "MOBILE_LOGIN_SUCCESS", "MOBILE_LOGIN_FAILURE"] },
      ...(Object.keys(dateFilter).length ? { createdAt: dateFilter } : {}),
    },
    select: { action: true, userId: true },
  });

  const userIds = [...new Set(logs.filter(l => l.userId).map(l => l.userId!))];
  const users = await prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
  const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

  const byUser = new Map<string, { userName: string; success: number; failure: number }>();
  for (const log of logs) {
    const uid = log.userId ?? "anonymous";
    const existing = byUser.get(uid) ?? { userName: userMap[uid] ?? "匿名", success: 0, failure: 0 };
    if (log.action.includes("SUCCESS")) existing.success++;
    else existing.failure++;
    byUser.set(uid, existing);
  }

  return success([...byUser.values()]);
}
