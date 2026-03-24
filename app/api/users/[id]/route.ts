import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateUserSchema } from "@/validators/user-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";

const userService = new UserService(prisma);
const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const user = await userService.getUser(id);
  return success(user);
});

export const PUT = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateUserSchema, raw);
  const user = await userService.updateUser(id, body);

  // Exclude sensitive fields from audit detail
  const { password: _pw, ...safeBody } = body as Record<string, unknown>;
  await auditService.log({
    userId: session.user.id,
    action: "UPDATE_USER",
    resourceType: "User",
    resourceId: id,
    detail: JSON.stringify(safeBody),
    ipAddress: getClientIp(req),
  });

  return success(user);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "unsuspend") {
    const user = await userService.unsuspendUser(id);
    await auditService.log({
      userId: session.user.id,
      action: "UNSUSPEND_USER",
      resourceType: "User",
      resourceId: id,
      detail: JSON.stringify({ action: "unsuspend" }),
      ipAddress: getClientIp(req),
    });
    return success(user);
  }

  // Default DELETE action = suspend
  const user = await userService.suspendUser(id);
  await auditService.log({
    userId: session.user.id,
    action: "SUSPEND_USER",
    resourceType: "User",
    resourceId: id,
    detail: JSON.stringify({ action: "suspend" }),
    ipAddress: getClientIp(req),
  });
  return success(user);
});
