import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { updateRiskSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { rid } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateRiskSchema, raw);
  const risk = await projectService.updateRisk(rid, body);
  return success(risk);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { rid } = await context.params;
  await projectService.deleteRisk(rid);
  return success({ success: true });
});
