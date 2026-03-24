import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { ImportService } from "@/services/import-service";
import { success, error } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";

const importService = new ImportService(prisma);

/**
 * POST /api/tasks/import
 *
 * Manager-only endpoint that accepts a multipart/form-data request with a
 * single field named "file" containing an .xlsx workbook.
 *
 * Excel columns (order matters for the template, but header names are used):
 *   title | description | assigneeEmail | status | priority | category | dueDate | estimatedHours
 *
 * Returns:
 *   { ok: true, data: { created: number, errors: RowValidationError[] } }
 */
export const POST = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return error("ValidationError", "Content-Type must be multipart/form-data", 400);
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return error("ParseError", "Failed to parse multipart form data", 400);
  }

  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return error("ValidationError", "Missing required field: file", 400);
  }

  const fileName = file instanceof File ? file.name : "upload";
  if (!fileName.endsWith(".xlsx")) {
    return error("ValidationError", "Only .xlsx files are supported", 400);
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let rows;
  try {
    rows = await importService.parseExcel(buffer);
  } catch (err) {
    return error(
      "ParseError",
      err instanceof Error ? err.message : "Failed to parse Excel file",
      400
    );
  }

  if (rows.length === 0) {
    return error("ValidationError", "Excel 檔案沒有資料列", 400);
  }

  const result = await importService.importTasks(rows, session.user.id);
  return success(result, 201);
});
