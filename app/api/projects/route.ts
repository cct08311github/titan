import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ProjectService } from "@/services/project-service";
import { validateBody } from "@/lib/validate";
import { createProjectSchema } from "@/validators/project-validators";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import type { ProjectStatus } from "@prisma/client";

const projectService = new ProjectService(prisma);

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);

  const items = await projectService.listProjects({
    year: searchParams.get("year") ? parseInt(searchParams.get("year")!) : undefined,
    status: searchParams.get("status") as ProjectStatus | undefined,
    requestDept: searchParams.get("requestDept") ?? undefined,
    priority: searchParams.get("priority") ?? undefined,
    search: searchParams.get("search") ?? undefined,
    page: searchParams.get("page") ? parseInt(searchParams.get("page")!) : undefined,
    limit: searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : undefined,
    sortBy: searchParams.get("sortBy") ?? undefined,
    sortOrder: (searchParams.get("sortOrder") as "asc" | "desc") ?? undefined,
  });

  return success(items);
});

export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();
  const raw = await req.json();
  const body = validateBody(createProjectSchema, raw);

  const project = await projectService.createProject({
    ...body,
    ownerId: body.ownerId ?? session.user.id,
  });

  return success(project, 201);
});
