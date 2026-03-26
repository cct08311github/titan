/**
 * GET /api/outline/documents — List Outline documents (tree structure)
 *
 * KB-1: Proxy API for Outline document listing.
 * Graceful fallback when Outline is unavailable.
 *
 * Fixes #840
 */
import { NextRequest } from "next/server";
import { withAuth } from "@/lib/auth-middleware";
import { success, error } from "@/lib/api-response";
import { getOutlineClient, OutlineApiError } from "@/services/outline-client";

export const GET = withAuth(async (_req: NextRequest) => {
  const client = getOutlineClient();

  if (!client.isEnabled) {
    return error(
      "OUTLINE_NOT_CONFIGURED",
      "Outline 知識庫未設定。請聯繫管理員設定 OUTLINE_INTERNAL_URL 和 OUTLINE_API_TOKEN。",
      503,
    );
  }

  try {
    const documents = await client.listDocuments();
    return success({ documents });
  } catch (err) {
    if (err instanceof OutlineApiError) {
      if (err.isTimeout) {
        return error(
          "OUTLINE_TIMEOUT",
          "Outline 服務回應逾時，請稍後再試。",
          504,
        );
      }
      return error(
        "OUTLINE_ERROR",
        `Outline 服務異常：${err.message}`,
        err.statusCode ?? 502,
      );
    }
    return error("OUTLINE_ERROR", "無法連線至 Outline 服務。", 502);
  }
});
