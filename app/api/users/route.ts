import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { UserService } from "@/services/user-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { createUserSchema } from "@/validators/user-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";

const userService = new UserService(prisma);
const auditService = new AuditService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const includeSuspended = searchParams.get("includeSuspended") === "true";
  const search = searchParams.get("search") ?? undefined;
  const role = searchParams.get("role") ?? undefined;

  const users = await userService.listUsers({ includeSuspended, search, role });
  return success(users);
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireRole("MANAGER");
  const raw = await req.json();
  const body = validateBody(createUserSchema, raw);
  const user = await userService.createUser(body);

  await auditService.log({
    userId: session.user.id,
    action: "CREATE_USER",
    resourceType: "User",
    resourceId: user.id,
    detail: JSON.stringify({ name: user.name, email: user.email, role: user.role }),
    ipAddress: getClientIp(req),
  });

  return success(user, 201);
});
