import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { escapeHtml } from "@/lib/security/sanitize";

/**
 * Extract a snippet around the matched keyword.
 * Returns ~50 chars before and after the match, with <mark> tags.
 */
function extractSnippet(text: string, keyword: string, contextLen = 50): string {
  if (!text || !keyword) return text?.substring(0, 100) ?? "";
  const lower = text.toLowerCase();
  const idx = lower.indexOf(keyword.toLowerCase());
  if (idx === -1) return text.substring(0, 100);

  const start = Math.max(0, idx - contextLen);
  const end = Math.min(text.length, idx + keyword.length + contextLen);
  let snippet = "";
  if (start > 0) snippet += "...";
  snippet += escapeHtml(text.substring(start, idx));
  snippet += `<mark>${escapeHtml(text.substring(idx, idx + keyword.length))}</mark>`;
  snippet += escapeHtml(text.substring(idx + keyword.length, end));
  if (end < text.length) snippet += "...";
  return snippet;
}

/**
 * GET /api/search?q=keyword&scope=all|documents|tasks|comments
 *
 * Enhanced unified search — Issue #859
 * Searches across Documents (title + content), Tasks (title + description),
 * TaskComments (content), KPIs, and Users.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim();
  const scope = searchParams.get("scope") ?? "all";

  if (!q) {
    return success({ tasks: [], documents: [], comments: [], kpis: [], users: [] });
  }

  if (q.length < 2) {
    return error("ValidationError", "請輸入至少 2 個字元", 422);
  }

  const isManager = session.user.role === "MANAGER";
  const userId = session.user.id;
  const containsQuery = { contains: q, mode: "insensitive" as const };

  const taskPermFilter = isManager
    ? {}
    : {
        OR: [
          { primaryAssigneeId: userId },
          { backupAssigneeId: userId },
          { creatorId: userId },
        ],
      };

  const searchDocuments = scope === "all" || scope === "documents";
  const searchTasks = scope === "all" || scope === "tasks";
  const searchComments = scope === "all" || scope === "comments";

  const [tasks, documents, comments, kpis, users] = await Promise.all([
    // Tasks: search by title + description
    searchTasks
      ? prisma.task.findMany({
          where: {
            isSample: false, deletedAt: null,
            OR: [
              { title: containsQuery },
              { description: containsQuery },
            ],
            ...taskPermFilter,
          },
          select: {
            id: true,
            title: true,
            description: true,
            status: true,
            priority: true,
            dueDate: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),

    // Documents: search by title + content
    searchDocuments
      ? prisma.document.findMany({
          where: { deletedAt: null,
            OR: [
              { title: containsQuery },
              { content: containsQuery },
            ],
          },
          select: {
            id: true,
            title: true,
            slug: true,
            content: true,
            updatedAt: true,
          },
          orderBy: { updatedAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),

    // Comments: search by content
    searchComments
      ? prisma.taskComment.findMany({
          where: {
            deletedAt: null,
            content: containsQuery,
            ...(isManager
              ? {}
              : {
                  task: {
                    OR: [
                      { primaryAssigneeId: userId },
                      { backupAssigneeId: userId },
                      { creatorId: userId },
                    ],
                  },
                }),
          },
          select: {
            id: true,
            content: true,
            taskId: true,
            createdAt: true,
            task: { select: { id: true, title: true } },
            user: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),

    // KPIs: search by code or title (scope=all only)
    scope === "all"
      ? prisma.kPI.findMany({
          where: { deletedAt: null,
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
        })
      : Promise.resolve([]),

    // Users: search by name (manager only, scope=all only)
    scope === "all" && isManager
      ? prisma.user.findMany({
          where: { name: containsQuery, isActive: true },
          select: { id: true, name: true, email: true, role: true },
          orderBy: { name: "asc" },
          take: 5,
        })
      : Promise.resolve([]),
  ]);

  return success({
    tasks: tasks.map((t) => ({
      type: "task" as const,
      id: t.id,
      title: t.title,
      snippet: extractSnippet(t.description ?? t.title, q),
      matchedText: t.title,
      updatedAt: t.updatedAt,
      status: t.status,
      priority: t.priority,
    })),
    documents: documents.map((d) => ({
      type: "document" as const,
      id: d.id,
      title: d.title,
      slug: d.slug,
      snippet: extractSnippet(d.content, q),
      matchedText: d.title,
      updatedAt: d.updatedAt,
    })),
    comments: comments.map((c) => ({
      type: "comment" as const,
      id: c.id,
      title: c.task.title,
      taskId: c.taskId,
      snippet: extractSnippet(c.content, q),
      matchedText: c.content.substring(0, 100),
      updatedAt: c.createdAt,
      authorName: c.user.name,
    })),
    kpis: kpis.map((k) => ({ ...k, type: "kpi" as const })),
    users: users.map((u) => ({ ...u, type: "user" as const })),
  });
});
