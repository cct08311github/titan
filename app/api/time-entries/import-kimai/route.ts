import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error as apiError } from "@/lib/api-response";
import { parseKimaiCsv, KimaiImportService } from "@/services/kimai-import-service";

/**
 * POST /api/time-entries/import-kimai
 *
 * Accepts multipart/form-data with a CSV file from Kimai export.
 * Parses the CSV and creates time entries for the authenticated user.
 *
 * Issue #740: [TS-31] Kimai 工時資料匯入功能
 */
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const userId = session.user.id;

  try {
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return apiError("BAD_REQUEST", "請上傳 CSV 檔案", 400);
    }

    // Validate file type
    if (!file.name.endsWith(".csv") && file.type !== "text/csv") {
      return apiError("BAD_REQUEST", "僅支援 CSV 格式（.csv）", 400);
    }

    // Limit file size (1MB)
    const MAX_SIZE = 1 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return apiError("BAD_REQUEST", "檔案大小不可超過 1MB", 400);
    }

    const text = await file.text();
    const rows = parseKimaiCsv(text);

    const service = new KimaiImportService(prisma);
    const result = await service.importRows(rows, userId);

    return success(result, result.errors.length > 0 ? 207 : 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "匯入失敗";
    return apiError("IMPORT_ERROR", message, 400);
  }
});
