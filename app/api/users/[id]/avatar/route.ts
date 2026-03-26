/**
 * POST/DELETE /api/users/:id/avatar — Issue #845 (S-1)
 *
 * POST: Upload avatar (JPG/PNG only, <=2MB, magic bytes validated).
 * DELETE: Remove avatar (restore default).
 *
 * Authorization: Users can only modify their own avatar.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { ForbiddenError } from "@/services/errors";

const AVATAR_MAX_BYTES = 2 * 1024 * 1024; // 2MB
const ALLOWED_AVATAR_MIMES = new Set(["image/jpeg", "image/png"]);

// Magic bytes for avatar types
const MAGIC_BYTES_MAP: { mime: string; bytes: number[] }[] = [
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
];

function validateMagicBytes(buffer: Uint8Array, declaredMime: string): boolean {
  const spec = MAGIC_BYTES_MAP.find((m) => m.mime === declaredMime);
  if (!spec) return false;
  return spec.bytes.every((b, i) => buffer[i] === b);
}

export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Users can only upload their own avatar
  if (session.user.id !== id) {
    throw new ForbiddenError("只能修改自己的頭像");
  }

  const formData = await req.formData();
  const file = formData.get("avatar") as File | null;

  if (!file) {
    return error("ValidationError", "請選擇檔案", 400);
  }

  // Validate MIME type
  if (!ALLOWED_AVATAR_MIMES.has(file.type)) {
    return error("ValidationError", "僅接受 JPG/PNG 格式", 400);
  }

  // Validate size
  if (file.size > AVATAR_MAX_BYTES) {
    const maxMB = AVATAR_MAX_BYTES / (1024 * 1024);
    return error("ValidationError", `檔案大小超過 ${maxMB}MB 上限`, 400);
  }

  // Validate magic bytes
  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!validateMagicBytes(buffer, file.type)) {
    return error("ValidationError", "檔案內容與宣告類型不符（可能為偽裝檔案）", 400);
  }

  // Convert to base64 data URL for storage
  const base64 = Buffer.from(buffer).toString("base64");
  const dataUrl = `data:${file.type};base64,${base64}`;

  const user = await prisma.user.update({
    where: { id },
    data: { avatar: dataUrl },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });

  return success(user);
});

export const DELETE = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  if (session.user.id !== id) {
    throw new ForbiddenError("只能修改自己的頭像");
  }

  const user = await prisma.user.update({
    where: { id },
    data: { avatar: null },
    select: { id: true, name: true, email: true, role: true, avatar: true },
  });

  return success(user);
});
