import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { submitReviewSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const projectService = new ProjectService(prisma);

export const POST = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(submitReviewSchema, raw);
  const project = await projectService.submitReview(id, body, session.user.id);
  return success(project);
});
