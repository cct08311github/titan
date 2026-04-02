import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const DELETE = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { sid } = await context.params;
  await projectService.deleteStakeholder(sid);
  return success({ success: true });
});
