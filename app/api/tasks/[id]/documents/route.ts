/**
 * GET/POST /api/tasks/:id/documents — Issue #842 (KB-3)
 *
 * GET: List all documents linked to a task.
 * POST: Link a new document to a task.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { TaskDocumentService } from "@/services/task-document-service";

const getService = () => new TaskDocumentService(prisma);

export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const docs = await getService().listByTask(id);
  return success(docs);
});

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  let body: { outlineDocumentId?: string; title?: string };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  if (!body.outlineDocumentId || !body.title) {
    return error("ValidationError", "outlineDocumentId 和 title 為必填", 400);
  }

  const doc = await getService().addDocument({
    taskId: id,
    outlineDocumentId: body.outlineDocumentId,
    title: body.title,
    addedBy: session.user.id,
  });

  return success(doc, 201);
});
