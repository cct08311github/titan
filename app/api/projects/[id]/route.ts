import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { AuditService } from "@/services/audit-service";
import { validateBody } from "@/lib/validate";
import { updateProjectSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireRole } from "@/lib/rbac";
import { getClientIp } from "@/lib/get-client-ip";

const projectService = new ProjectService(prisma);
const auditService = new AuditService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const project = await projectService.getProject(id);
  return success(project);
});

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateProjectSchema, raw);
  const project = await projectService.updateProject(id, body);
  return success(project);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireRole("MANAGER");
  const { id } = await context.params;
  await projectService.deleteProject(id);

  await auditService.log({
    userId: session.user.id,
    action: "DELETE_PROJECT",
    resourceType: "Project",
    resourceId: id,
    detail: null,
    ipAddress: getClientIp(req),
  });

  return success({ success: true });
});
