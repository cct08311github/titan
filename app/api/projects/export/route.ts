import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { withAuth } from "@/lib/auth-middleware";
import type { ProjectStatus } from "@prisma/client";

const projectService = new ProjectService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const csv = await projectService.exportCsv({
    year: searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined,
    status: searchParams.get("status") as ProjectStatus | undefined,
    requestDept: searchParams.get("requestDept") ?? undefined,
  });

  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="projects-${new Date().toISOString().split("T")[0]}.csv"`,
    },
  });
});
