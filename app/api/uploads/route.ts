/**
 * Image Upload API — Issue #929
 *
 * POST /api/uploads — accept multipart/form-data with a single image file.
 * Validates: JPG/PNG/GIF/WebP only, max 5 MB, magic bytes check.
 * Saves to public/uploads/ with a UUID filename.
 * Returns { url: "/uploads/{filename}" }.
 * Requires authentication.
 */

import { NextRequest } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { withAuth } from "@/lib/auth-middleware";
import { success, error } from "@/lib/api-response";

const MAX_SIZE = 5 * 1024 * 1024; // 5 MB

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

/** Magic byte signatures for allowed image types */
const MAGIC_BYTES: { mime: string; bytes: number[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] }, // GIF8
  { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] }, // RIFF
];

function validateMagicBytes(buffer: Uint8Array, declaredMime: string): boolean {
  const spec = MAGIC_BYTES.find((m) => m.mime === declaredMime);
  if (!spec) return false;
  return spec.bytes.every((b, i) => buffer[i] === b);
}

export const POST = withAuth(async (req: NextRequest) => {
  const formData = await req.formData();
  const file = formData.get("file");

  if (!file || !(file instanceof File)) {
    return error("ValidationError", "缺少圖片檔案", 400);
  }

  // Validate MIME type
  const ext = ALLOWED_TYPES[file.type];
  if (!ext) {
    return error(
      "ValidationError",
      "僅允許 JPG、PNG、GIF、WebP 格式的圖片",
      400
    );
  }

  // Validate file size
  if (file.size > MAX_SIZE) {
    return error("ValidationError", "圖片大小不得超過 5MB", 400);
  }

  // Read buffer and validate magic bytes
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!validateMagicBytes(buffer, file.type)) {
    return error("ValidationError", "檔案內容與宣告的類型不符", 400);
  }

  // Generate unique filename
  const filename = `${crypto.randomUUID()}${ext}`;
  const uploadDir = path.join(process.cwd(), "public", "uploads");

  // Ensure upload directory exists
  await mkdir(uploadDir, { recursive: true });

  // Write file
  await writeFile(path.join(uploadDir, filename), buffer);

  return success({ url: `/uploads/${filename}` }, 201);
});
