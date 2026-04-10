/**
 * GET /api/tasks/stale — Issue #1312
 *
 * Returns stale tasks for the authenticated user, scoped by role:
 *   ENGINEER → own tasks only
 *   MANAGER  → all team tasks
 *   ADMIN    → all tasks, ESCALATE-first
 *
 * Query params (all optional):
 *   limit  number (1–100, default 50)
 *   level  "REMIND" | "WARN" | "ESCALATE"  (filter to single level)
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { listStaleTasksForUser } from "@/services/stale-task-service";
import { logger } from "@/lib/logger";
import { withAuth } from "@/lib/auth-middleware";

const querySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v !== undefined ? Number(v) : 50))
    .pipe(z.number().int().min(1).max(100)),
  level: z
    .enum(["REMIND", "WARN", "ESCALATE"])
    .optional(),
});

// Wrapped in withAuth for CSRF + rate limit + password-change enforcement
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  // ── Validate query params ────────────────────────────────────────────────
  const { searchParams } = new URL(req.url);
  const rawParams = {
    limit: searchParams.get("limit") ?? undefined,
    level: searchParams.get("level") ?? undefined,
  };

  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    const message = parsed.error.issues.map((i) => i.message).join("; ");
    return error("ValidationError", `無效的查詢參數：${message}`, 400);
  }

  const { limit, level } = parsed.data;

  // ── Fetch stale tasks ────────────────────────────────────────────────────
  try {
    const role = session.user.role as "ADMIN" | "MANAGER" | "ENGINEER";
    const tasks = await listStaleTasksForUser(session.user.id, role);

    // Apply optional level filter
    const filtered = level ? tasks.filter((t) => t.level === level) : tasks;

    // Apply limit
    const limited = filtered.slice(0, limit);

    return success({ tasks: limited, total: filtered.length });
  } catch (err) {
    logger.error({ err, event: "stale_route_error" }, "[stale-route] unexpected error");
    return error("InternalError", "伺服器錯誤，請稍後再試", 500);
  }
});
