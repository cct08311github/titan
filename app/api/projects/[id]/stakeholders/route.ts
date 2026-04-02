import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { createStakeholderSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const stakeholders = await projectService.listStakeholders(id);
  return success(stakeholders);
});

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createStakeholderSchema, raw);
  const stakeholder = await projectService.createStakeholder(id, body);
  return success(stakeholder, 201);
});
