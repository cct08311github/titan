import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { createIssueSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const issues = await projectService.listIssues(id);
  return success(issues);
});

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(createIssueSchema, raw);
  const issue = await projectService.createIssue(id, body);
  return success(issue, 201);
});
