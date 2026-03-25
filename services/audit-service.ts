import { PrismaClient } from "@prisma/client";
import { ForbiddenError } from "./errors";

export interface LogAuditInput {
  userId: string | null;
  action: string;
  resourceType?: string;
  resourceId?: string | null;
  detail?: string | null;
  details?: string | null;
  ipAddress?: string | null;
  targetId?: string | null;
  targetType?: string | null;
}

export interface QueryAuditLogsInput {
  callerId: string;
  callerRole: string;
  action?: string;
  userId?: string;
  resourceType?: string;
  limit?: number;
}

export class AuditService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Persist an audit log entry. All timestamps are generated server-side (UTC).
   * This method has no update/delete counterpart — audit logs are immutable.
   */
  async log(input: LogAuditInput) {
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? null,
        action: input.action,
        resourceType: input.resourceType ?? input.targetType ?? "unknown",
        resourceId: input.resourceId ?? null,
        detail: input.detail ?? null,
        ipAddress: input.ipAddress ?? null,
        // createdAt is server-side UTC via Prisma @default(now())
      },
    });
  }

  /**
   * Query audit logs. Only MANAGER role may call this.
   * Audit logs are read-only — no update or delete methods are exposed.
   */
  async queryLogs(input: QueryAuditLogsInput) {
    if (input.callerRole !== "MANAGER") {
      throw new ForbiddenError("權限不足：僅限管理員查詢稽核日誌");
    }

    const where: Record<string, unknown> = {};
    if (input.action) where.action = input.action;
    if (input.userId) where.userId = input.userId;
    if (input.resourceType) where.resourceType = input.resourceType;

    return this.prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: input.limit ?? 200,
    });
  }
}
