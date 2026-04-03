import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { updateGateSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const projectService = new ProjectService(prisma);

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id, gid } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateGateSchema, raw);
  const gate = await projectService.updateGate(gid, body, session.user.id, id);
  return success(gate);
});
