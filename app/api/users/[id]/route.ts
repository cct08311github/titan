import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateUserSchema } from "@/validators/user-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const userService = new UserService(prisma);
const auditService = new AuditService(prisma);

function getClientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
}

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
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateUserSchema, raw);
  const user = await userService.updateUser(id, body);

  const { password: _pw, ...safeBody } = body;
  await auditService.log({
    userId: session.user.id,
    action: "USER_UPDATE",
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
  const session = await requireAuth();
  const { id } = await context.params;
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  if (action === "unsuspend") {
    const user = await userService.unsuspendUser(id);
    await auditService.log({
      userId: session.user.id,
      action: "USER_UNSUSPEND",
      resourceType: "User",
      resourceId: id,
      ipAddress: getClientIp(req),
    });
    return success(user);
  }

  // Default DELETE action = suspend
  const user = await userService.suspendUser(id);
  await auditService.log({
    userId: session.user.id,
    action: "USER_SUSPEND",
    resourceType: "User",
    resourceId: id,
    ipAddress: getClientIp(req),
  });
  return success(user);
});
