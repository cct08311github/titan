import { NextRequest } from "next/server";
import { ValidationError } from "@/services/errors";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success } from "@/lib/api-response";
import { PermissionService } from "@/services/permission-service";
import { prisma } from "@/lib/prisma";

const permissionService = new PermissionService(prisma);

/** GET /api/permissions — list all permissions (MANAGER only) */
export const GET = withManager(async (req: NextRequest) => {
  const url = new URL(req.url);
  const granteeId = url.searchParams.get("granteeId") ?? undefined;
  const permType = url.searchParams.get("permType") ?? undefined;
  const isActiveParam = url.searchParams.get("isActive");
  const isActive =
    isActiveParam === "true" ? true : isActiveParam === "false" ? false : undefined;

  const permissions = await permissionService.listPermissions({
    granteeId,
    permType,
    isActive,
  });

  return success(permissions);
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

  return success(permission, 201);
});

/** DELETE /api/permissions — revoke a permission (MANAGER only) */
export const DELETE = withManager(async (req: NextRequest) => {
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

  return success({ message: "已撤銷授權" });
});
