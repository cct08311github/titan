import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateUserSchema } from "@/validators/user-validators";
import { success, error } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { sanitizeHtml } from "@/lib/security/sanitize";
import { requireAuth, requireRole } from "@/lib/rbac";
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

  // Privilege escalation guard: only ADMIN can assign the ADMIN role.
  // Without this, any MANAGER could promote themselves or others to ADMIN.
  if (body.role === "ADMIN" && session.user.role !== "ADMIN") {
    return error("ForbiddenError", "只有管理員可以指派管理員角色", 403);
  }

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

/**
 * PATCH /api/users/:id — Issue #845 (S-1)
 * Self-edit: users can update their own name (not email/role/password).
 */
export const PATCH = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Users can only PATCH their own profile
  if (session.user.id !== id) {
    return NextResponse.json(
      { ok: false, error: "ForbiddenError", message: "只能修改自己的資料" },
      { status: 403 }
    );
  }

  const raw = await req.json();
  // Only allow name updates via self-edit
  const rawName = typeof raw.name === "string" ? raw.name.trim() : undefined;
  if (!rawName || rawName.length === 0) {
    return NextResponse.json(
      { ok: false, error: "ValidationError", message: "姓名為必填" },
      { status: 400 }
    );
  }

  const cleanName = sanitizeHtml(rawName);
  if (!cleanName) {
    return error("ValidationError", "姓名不可為空", 400);
  }

  const user = await userService.updateUser(id, { name: cleanName });
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
