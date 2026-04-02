import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { updateIssueSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { iid } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateIssueSchema, raw);
  const issue = await projectService.updateIssue(iid, body);
  return success(issue);
});

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { iid } = await context.params;
  await projectService.deleteIssue(iid);
  return success({ success: true });
});
