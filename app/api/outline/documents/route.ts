/**
 * GET /api/outline/documents/:id — Get Outline document content
 *
 * KB-1: Proxy API for Outline document retrieval.
 * Returns markdown content for rendering (no iframe).
 *
 * Fixes #840
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { success, error } from "@/lib/api-response";
import { getOutlineClient, OutlineApiError } from "@/services/outline-client";

export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return error("BAD_REQUEST", "Document ID is required", 400);
  }

  const client = getOutlineClient();

  if (!client.isEnabled) {
    return error(
      "OUTLINE_NOT_CONFIGURED",
      "Outline 知識庫未設定。",
      503,
    );
  }

  try {
    const document = await client.getDocument(id);
    return success({
      id: document.id,
      title: document.title,
      content: document.text,
      parentDocumentId: document.parentDocumentId,
      updatedAt: document.updatedAt,
      updatedBy: document.updatedBy,
    });
  } catch (err) {
    if (err instanceof OutlineApiError) {
      if (err.statusCode === 404) {
        return error("NOT_FOUND", "文件不存在。", 404);
      }
      if (err.isTimeout) {
        return error("OUTLINE_TIMEOUT", "Outline 服務回應逾時。", 504);
      }
      // Don't leak err.message — may contain internal URLs/IPs
      return error("OUTLINE_ERROR", "Outline 服務異常，請稍後再試。", err.statusCode ?? 502);
    }
    return error("OUTLINE_ERROR", "無法連線至 Outline 服務。", 502);
  }
});
