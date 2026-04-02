/**
 * GET /api/reports/login-activity — Issue #1161
 *
 * Banking compliance login activity report:
 * - mode=detail (default): every login/logout event with timestamp, IP, user-agent
 * - mode=summary: success/failure/logout counts by user
 *
 * Filters: from, to, userId, result (success|failure|all)
 * Pagination: limit (default 200, max 5000), offset
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireManagerOrAbove as requireManager } from "@/lib/auth";
import { success, error } from "@/lib/api-response";

const LOGIN_ACTIONS = [
  "LOGIN_SUCCESS", "LOGIN_FAILURE",
  "MOBILE_LOGIN_SUCCESS", "MOBILE_LOGIN_FAILURE",
  "LOGOUT", "MOBILE_LOGOUT", "SESSION_TIMEOUT", "ACCOUNT_LOCKED", "PASSWORD_CHANGE",
];

export async function GET(req: NextRequest) {
  try { await requireManager(); } catch { return error("ForbiddenError", "僅限管理員", 403); }

  const { searchParams } = new URL(req.url);
  const mode = searchParams.get("mode") ?? "detail";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const userId = searchParams.get("userId");
  const result = searchParams.get("result");
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "200"), 5000);
  const offset = parseInt(searchParams.get("offset") ?? "0");

  const where: Record<string, unknown> = { action: { in: LOGIN_ACTIONS } };
  if (from || to) {
    const df: Record<string, Date> = {};
    if (from) df.gte = new Date(from);
    if (to) df.lte = new Date(`${to}T23:59:59.999Z`);
    where.createdAt = df;
  }
  if (userId) where.userId = userId;
  if (result === "success") where.action = { in: LOGIN_ACTIONS.filter(a => a.includes("SUCCESS")) };
  else if (result === "failure") where.action = { in: LOGIN_ACTIONS.filter(a => a.includes("FAILURE") || a === "ACCOUNT_LOCKED") };

  if (mode === "summary") {
    const logs = await prisma.auditLog.findMany({ where, select: { action: true, userId: true } });
    const uids = [...new Set(logs.filter(l => l.userId).map(l => l.userId!))];
    const users = await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true, email: true } });
    const um = Object.fromEntries(users.map(u => [u.id, u]));

    const byUser = new Map<string, { userName: string; email: string; success: number; failure: number; logout: number }>();
    for (const log of logs) {
      const uid = log.userId ?? "anonymous";
      const u = um[uid];
      const e = byUser.get(uid) ?? { userName: u?.name ?? "匿名", email: u?.email ?? "-", success: 0, failure: 0, logout: 0 };
      if (log.action.includes("SUCCESS")) e.success++;
      else if (log.action.includes("FAILURE") || log.action === "ACCOUNT_LOCKED") e.failure++;
      else e.logout++;
      byUser.set(uid, e);
    }
    return success({ summary: [...byUser.values()], total: logs.length });
  }

  // Detail mode — compliance-grade: every event with full context
  const [entries, total] = await Promise.all([
    prisma.auditLog.findMany({ where, orderBy: { createdAt: "desc" }, take: limit, skip: offset }),
    prisma.auditLog.count({ where }),
  ]);

  const uids = [...new Set(entries.filter(e => e.userId).map(e => e.userId!))];
  const users = uids.length ? await prisma.user.findMany({ where: { id: { in: uids } }, select: { id: true, name: true, email: true, role: true } }) : [];
  const um = Object.fromEntries(users.map(u => [u.id, u]));

  return success({
    entries: entries.map(e => {
      const u = e.userId ? um[e.userId] : null;
      return { id: e.id, timestamp: e.createdAt.toISOString(), user: u ? { id: u.id, name: u.name, email: u.email, role: u.role } : null, action: e.action, detail: e.detail, ipAddress: e.ipAddress, userAgent: e.userAgent };
    }),
    total, limit, offset,
  });
}
