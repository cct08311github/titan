/**
 * Admin: Stale-Task Threshold Settings API — Issue #1313
 *
 * GET  /api/admin/settings/stale-task  — read current config (ADMIN only)
 * PUT  /api/admin/settings/stale-task  — update config (ADMIN only)
 *
 * Access: ADMIN role only (enforced via withAdmin middleware)
 * Audit:  all successful PUT operations write an AuditLog entry
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import { success } from "@/lib/api-response";
import { withAdmin } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { ValidationError } from "@/services/errors";
import {
  getSetting,
  setSetting,
} from "@/services/system-setting-service";
import {
  STALE_TASK_CONFIG_KEY,
  STALE_REMIND_DAYS,
  STALE_WARN_DAYS,
  STALE_ESCALATE_DAYS,
  type StaleTaskConfig,
} from "@/services/stale-task-service";
import { AuditService } from "@/services/audit-service";
import { prisma } from "@/lib/prisma";

// ── Default values (mirrors constants in stale-task-service) ─────────────────

const DEFAULT_CONFIG: StaleTaskConfig = {
  remindDays: STALE_REMIND_DAYS,
  warnDays: STALE_WARN_DAYS,
  escalateDays: STALE_ESCALATE_DAYS,
};

// ── Validation schema ────────────────────────────────────────────────────────

const StaleTaskConfigSchema = z
  .object({
    remindDays: z
      .number({ error: "remindDays 必須是數字" })
      .int("remindDays 必須是整數")
      .min(1, "remindDays 最小為 1")
      .max(59, "remindDays 最大為 59"),
    warnDays: z
      .number({ error: "warnDays 必須是數字" })
      .int("warnDays 必須是整數")
      .min(2, "warnDays 最小為 2")
      .max(60, "warnDays 最大為 60"),
    escalateDays: z
      .number({ error: "escalateDays 必須是數字" })
      .int("escalateDays 必須是整數")
      .min(3, "escalateDays 最小為 3")
      .max(60, "escalateDays 最大為 60"),
  })
  .refine((d) => d.remindDays < d.warnDays, {
    message: "remindDays 必須小於 warnDays",
    path: ["remindDays"],
  })
  .refine((d) => d.warnDays < d.escalateDays, {
    message: "warnDays 必須小於 escalateDays",
    path: ["warnDays"],
  });

// ── GET: read current config ─────────────────────────────────────────────────

export const GET = withAdmin(async (_req: NextRequest) => {
  const config = await getSetting<StaleTaskConfig>(STALE_TASK_CONFIG_KEY, DEFAULT_CONFIG);
  return success({ config });
});

// ── PUT: update config ───────────────────────────────────────────────────────

export const PUT = withAdmin(async (req: NextRequest) => {
  // Get session for audit logging (withAdmin already verified role)
  const session = await requireAuth();
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ValidationError("請求 body 必須是有效的 JSON");
  }

  const parseResult = StaleTaskConfigSchema.safeParse(body);
  if (!parseResult.success) {
    const firstIssue = parseResult.error.issues[0];
    throw new ValidationError(firstIssue?.message ?? "設定值不合法");
  }

  const newConfig = parseResult.data;

  // Read old value for audit log (before overwrite)
  const oldConfig = await getSetting<StaleTaskConfig>(STALE_TASK_CONFIG_KEY, DEFAULT_CONFIG);

  // Persist new config
  await setSetting(STALE_TASK_CONFIG_KEY, newConfig, userId);

  // Write audit log (fire-and-forget)
  const auditService = new AuditService(prisma);
  auditService
    .logAsync({
      userId,
      action: "admin.settings.staleTask.update",
      resourceType: "SystemSetting",
      resourceId: STALE_TASK_CONFIG_KEY,
      detail: JSON.stringify({ before: oldConfig, after: newConfig }),
    })
    .catch(() => {
      // audit failure must not block the response
    });

  return success({ config: newConfig });
});
