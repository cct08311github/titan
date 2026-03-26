/**
 * Unified Activity Logger — Issue #802 (AF-1)
 *
 * Event-sourcing-style activity log that serves both:
 *   - 團隊動態牆 (team activity feed)
 *   - 稽核日誌 (audit log for compliance)
 *
 * All modules call logActivity() to record operations.
 * Activity logs are append-only — no update or delete.
 *
 * Uses the existing AuditLog model (extended with module, userAgent, metadata fields).
 */

import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

// ── Action types ─────────────────────────────────────────────────────────

export const ActivityAction = {
  CREATE: "CREATE",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
  LOGIN: "LOGIN",
  LOGOUT: "LOGOUT",
  STATUS_CHANGE: "STATUS_CHANGE",
  LOGIN_FAILURE: "LOGIN_FAILURE",
  PASSWORD_CHANGE: "PASSWORD_CHANGE",
  ROLE_CHANGE: "ROLE_CHANGE",
  ACCOUNT_LOCK: "ACCOUNT_LOCK",
  ACCOUNT_UNLOCK: "ACCOUNT_UNLOCK",
  SESSION_TIMEOUT: "SESSION_TIMEOUT",
  PERMISSION_GRANT: "PERMISSION_GRANT",
  PERMISSION_REVOKE: "PERMISSION_REVOKE",
  EXPORT: "EXPORT",
  IMPORT: "IMPORT",
} as const;

export type ActivityActionType = (typeof ActivityAction)[keyof typeof ActivityAction];

// ── Module types ─────────────────────────────────────────────────────────

export const ActivityModule = {
  AUTH: "AUTH",
  KANBAN: "KANBAN",
  TIMESHEET: "TIMESHEET",
  KPI: "KPI",
  ADMIN: "ADMIN",
  GANTT: "GANTT",
  PLAN: "PLAN",
  SETTINGS: "SETTINGS",
  KNOWLEDGE: "KNOWLEDGE",
  REPORT: "REPORT",
  NOTIFICATION: "NOTIFICATION",
} as const;

export type ActivityModuleType = (typeof ActivityModule)[keyof typeof ActivityModule];

// ── Input type ───────────────────────────────────────────────────────────

export interface LogActivityInput {
  userId: string | null;
  action: ActivityActionType | string;
  module: ActivityModuleType | string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
}

// ── Core function ────────────────────────────────────────────────────────

/**
 * Record an activity log entry. Append-only — never update or delete.
 *
 * This is the single entry point for all modules to record operations.
 * Failures are logged but never thrown to avoid blocking business logic.
 */
export async function logActivity(input: LogActivityInput): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        module: input.module,
        resourceType: input.targetType ?? "unknown",
        resourceId: input.targetId ?? null,
        metadata: input.metadata
          ? (input.metadata as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        detail: input.metadata ? JSON.stringify(input.metadata) : null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Fire-and-forget: never let logging failure break business logic
    logger.error(
      { err, action: input.action, module: input.module },
      "[activity-logger] Failed to write activity log"
    );
  }
}

/**
 * Query activity logs with pagination and filtering.
 * Used by GET /api/activity endpoint.
 */
export async function queryActivityLogs(params: {
  userId?: string;
  action?: string;
  module?: string;
  resourceType?: string;
  page?: number;
  limit?: number;
}): Promise<{ items: unknown[]; total: number; page: number; limit: number }> {
  const page = Math.max(1, params.page ?? 1);
  const limit = Math.min(100, Math.max(1, params.limit ?? 20));
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};
  if (params.userId) where.userId = params.userId;
  if (params.action) where.action = params.action;
  if (params.module) where.module = params.module;
  if (params.resourceType) where.resourceType = params.resourceType;

  const [items, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return { items, total, page, limit };
}
