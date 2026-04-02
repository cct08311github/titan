import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const GET = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const gates = await projectService.listGates(id);
  return success(gates);
});
