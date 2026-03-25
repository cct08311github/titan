import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

/**
 * GET /api/search?q=keyword
 *
 * Unified search endpoint that searches across tasks, documents, KPIs, and users.
 * Returns up to 5 results per resource type.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();

  if (!q || q.length < 1) {
    return error("ValidationError", "搜尋關鍵字不得為空", 400);
  }

  const isManager = session.user.role === "MANAGER";
  const userId = session.user.id;
  const containsQuery = { contains: q, mode: "insensitive" as const };

  // Run all searches in parallel
  const [tasks, documents, kpis, users] = await Promise.all([
    // Tasks: search by title — engineers see only their assigned tasks
    prisma.task.findMany({
      where: {
        title: containsQuery,
        ...(isManager
          ? {}
          : {
              OR: [
                { primaryAssigneeId: userId },
                { backupAssigneeId: userId },
                { creatorId: userId },
              ],
            }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),

    // Documents: search by title
    prisma.document.findMany({
      where: { title: containsQuery },
      select: {
        id: true,
        title: true,
        slug: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),

    // KPIs: search by code or title
    prisma.kPI.findMany({
      where: {
        OR: [
          { code: containsQuery },
          { title: containsQuery },
        ],
      },
      select: {
        id: true,
        code: true,
        title: true,
        status: true,
        year: true,
      },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),

    // Users: search by name (manager only)
    isManager
      ? prisma.user.findMany({
          where: {
            name: containsQuery,
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
          orderBy: { name: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return success({
    tasks: tasks.map((t) => ({ ...t, type: "task" as const })),
    documents: documents.map((d) => ({ ...d, type: "document" as const })),
    kpis: kpis.map((k) => ({ ...k, type: "kpi" as const })),
    users: users.map((u) => ({ ...u, type: "user" as const })),
  });
});
