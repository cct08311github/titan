import { NextRequest } from "next/server";
import { ValidationError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth, requireRole } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { PermissionService } from "@/services/permission-service";
import { AuditService } from "@/services/audit-service";
import { prisma } from "@/lib/prisma";
import { getClientIp } from "@/lib/get-client-ip";
import { parsePagination } from "@/lib/pagination";

const permissionService = new PermissionService(prisma);
const auditService = new AuditService(prisma);

/** GET /api/permissions — list all permissions (MANAGER only) */
export const GET = withManager(async (req: NextRequest) => {
  const url = new URL(req.url);
  const granteeId = url.searchParams.get("granteeId") ?? undefined;
  const permType = url.searchParams.get("permType") ?? undefined;
  const isActiveParam = url.searchParams.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;
  const { page, limit, skip } = parsePagination(url.searchParams);

  const filter = { granteeId, permType, isActive };

  const [permissions, total] = await Promise.all([
    permissionService.listPermissions(filter, { skip, take: limit }),
    permissionService.countPermissions(filter),
  ]);

  return success({ items: permissions, total, page, limit });
});

/** POST /api/permissions — grant a permission (MANAGER only) */
export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const body = await req.json();
  const { granteeId, permType, targetId, expiresAt } = body;

  if (!granteeId || !permType) {
    throw new ValidationError("缺少必填欄位：granteeId, permType");
  }

  const permission = await permissionService.grantPermission({
    granteeId,
    granterId: session.user.id,
    permType,
    targetId: targetId ?? null,
    expiresAt: expiresAt ? new Date(expiresAt) : null,
  });

  await auditService.log({
    userId: session.user.id,
    action: "GRANT_PERMISSION",
    resourceType: "Permission",
    resourceId: permission.id,
    detail: JSON.stringify({ granteeId, permType, targetId: targetId ?? null }),
    ipAddress: getClientIp(req),
  });

  return success(permission, 201);
});

/** DELETE /api/permissions — revoke a permission (MANAGER only) */
export const DELETE = withManager(async (req: NextRequest) => {
  const session = await requireRole("MANAGER");
  const body = await req.json();
  const { granteeId, permType, targetId } = body;

  if (!granteeId || !permType) {
    throw new ValidationError("缺少必填欄位：granteeId, permType");
  }

  await permissionService.revokePermission({
    granteeId,
    permType,
    targetId: targetId ?? null,
  });

  await auditService.log({
    userId: session.user.id,
    action: "REVOKE_PERMISSION",
    resourceType: "Permission",
    resourceId: null,
    detail: JSON.stringify({ granteeId, permType, targetId: targetId ?? null }),
    ipAddress: getClientIp(req),
  });

  return success({ message: "已撤銷授權" });
});
