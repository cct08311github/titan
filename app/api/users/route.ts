import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { createUserSchema } from "@/validators/user-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const userService = new UserService(prisma);
const auditService = new AuditService(prisma);

function getClientIp(req: NextRequest): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? null;
}

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const includeSuspended = searchParams.get("includeSuspended") === "true";

  const users = await userService.listUsers({ includeSuspended });
  return success(users);
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const body = validateBody(createUserSchema, raw);
  const user = await userService.createUser(body);

  const { password: _pw, ...safeBody } = body;
  await auditService.log({
    userId: session.user.id,
    action: "USER_CREATE",
    resourceType: "User",
    resourceId: user.id,
    detail: JSON.stringify({ name: safeBody.name, email: safeBody.email, role: safeBody.role }),
    ipAddress: getClientIp(req),
  });

  return success(user, 201);
});
