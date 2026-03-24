import { PrismaClient } from "@prisma/client";
import { ValidationError } from "./errors";

export type PermissionScope = "VIEW_TEAM" | "VIEW_OWN";

const VALID_SCOPES: PermissionScope[] = ["VIEW_TEAM", "VIEW_OWN"];

export interface GrantPermissionInput {
  granteeId: string;
  granterId: string;
  permType: string;
  targetId?: string | null;
  expiresAt?: Date | null;
}

export interface RevokePermissionInput {
  granteeId: string;
  permType: string;
  targetId?: string | null;
}

export interface ListPermissionsFilter {
  granteeId?: string;
  granterId?: string;
  permType?: string;
  isActive?: boolean;
}

export class PermissionService {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Grant a permission to a user.
   * Throws ValidationError if permType is not a recognised scope.
   */
  async grantPermission(input: GrantPermissionInput) {
    if (!VALID_SCOPES.includes(input.permType as PermissionScope)) {
      throw new ValidationError(
        `無效的 permType：${input.permType}，允許值：${VALID_SCOPES.join(", ")}`
      );
    }

    return this.prisma.permission.create({
      data: {
        granteeId: input.granteeId,
        granterId: input.granterId,
        permType: input.permType,
        targetId: input.targetId ?? null,
        expiresAt: input.expiresAt ?? null,
        isActive: true,
      },
    });
  }

  /**
   * Revoke a permission by setting isActive = false.
   */
  async revokePermission(input: RevokePermissionInput) {
    return this.prisma.permission.updateMany({
      where: {
        granteeId: input.granteeId,
        permType: input.permType,
        targetId: input.targetId ?? null,
      },
      data: { isActive: false },
    });
  }

  /**
   * List all permission records matching the given filter.
   */
  async listPermissions(filter: ListPermissionsFilter) {
    const where: Record<string, unknown> = {};
    if (filter.granteeId !== undefined) where.granteeId = filter.granteeId;
    if (filter.granterId !== undefined) where.granterId = filter.granterId;
    if (filter.permType !== undefined) where.permType = filter.permType;
    if (filter.isActive !== undefined) where.isActive = filter.isActive;

    return this.prisma.permission.findMany({
      where,
      include: {
        grantee: { select: { id: true, name: true, email: true, role: true } },
        granter: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  /**
   * Check if a user has a given scope via an active, non-expired Permission row.
   * Does NOT consider role — use hasPermissionForUser for role-aware checks.
   */
  async hasPermission(userId: string, scope: PermissionScope): Promise<boolean> {
    const permission = await this.prisma.permission.findFirst({
      where: {
        granteeId: userId,
        permType: scope,
        isActive: true,
        OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
      },
    });
    return permission !== null;
  }

  /**
   * Role-aware permission check.
   * MANAGER always returns true without hitting the Permission table.
   * ENGINEER falls back to hasPermission.
   */
  async hasPermissionForUser(userId: string, scope: PermissionScope): Promise<boolean> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true },
    });

    if (!user) return false;
    if (user.role === "MANAGER") return true;

    return this.hasPermission(userId, scope);
  }
}
