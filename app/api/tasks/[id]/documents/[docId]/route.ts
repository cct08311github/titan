/**
 * DELETE /api/tasks/:id/documents/:docId — Issue #842 (KB-3)
 *
 * Remove a document link from a task.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";
import { TaskDocumentService } from "@/services/task-document-service";

const getService = () => new TaskDocumentService(prisma);

export const DELETE = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id, docId } = await context.params;
  await getService().removeDocument(id, docId);
  return success({ id: docId });
});
