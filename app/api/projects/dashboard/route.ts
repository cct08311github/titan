import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

const projectService = new ProjectService(prisma);

export const GET = withManager(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const year = searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined;
  const stats = await projectService.getDashboardStats(year);
  return success(stats);
});
