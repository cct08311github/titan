/**
 * POST / GET / DELETE /api/tasks/[id]/attachments
 *
 * Issue #811 (K-3b): Task attachment CRUD with file validation.
 * Files stored under uploads/<taskId>/<cuid>-<filename>.
 */

import { NextRequest } from "next/server";
import { writeFile, mkdir, unlink, readFile } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { NotFoundError } from "@/services/errors";
import {
  validateFileSize,
  validateMimeType,
  validateMagicBytes,
  FILE_UPLOAD_CONFIG,
} from "@/lib/security/file-validator";
import { createLoginRateLimiter, checkRateLimit } from "@/lib/rate-limiter";
import { logger } from "@/lib/logger";

const UPLOAD_ROOT = path.join(process.cwd(), "uploads");

// Rate limit attachment uploads per user to prevent disk-fill DoS.
const attachmentRateLimiter = createLoginRateLimiter({
  points: 30,
  duration: 300,
});

/**
 * GET /api/tasks/:id/attachments — list attachments for a task
 */
export const GET = withAuth(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!task) throw new NotFoundError(`Task not found: ${id}`);

  const attachments = await prisma.taskAttachment.findMany({
    where: { taskId: id },
    include: {
      uploader: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,  // safety cap
  });

  return success(attachments);
});

/**
 * POST /api/tasks/:id/attachments — upload a file
 *
 * Expects multipart/form-data with a single "file" field.
 */
export const POST = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  // Rate limit per user
  if (process.env.NODE_ENV !== "test") {
    try {
      await checkRateLimit(attachmentRateLimiter, session.user.id);
    } catch {
      logger.warn({ userId: session.user.id, event: "attachment_rate_limited" }, "Attachment upload rate limit exceeded");
      return error("RateLimitError", "上傳次數過於頻繁，請稍後再試", 429);
    }
  }

  // Verify task exists
  const task = await prisma.task.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!task) throw new NotFoundError(`Task not found: ${id}`);

  // Parse multipart form data
  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return error("ValidationError", "缺少檔案", 400);
  }

  // Validate file size
  const sizeResult = validateFileSize(file.size);
  if (!sizeResult.valid) {
    return error("ValidationError", sizeResult.error.message, 400);
  }

  // Validate MIME type
  const mimeResult = validateMimeType(file.type);
  if (!mimeResult.valid) {
    return error("ValidationError", mimeResult.error.message, 400);
  }

  // Read buffer for magic bytes validation
  const arrayBuffer = await file.arrayBuffer();
  const buffer = new Uint8Array(arrayBuffer);
  const magicResult = validateMagicBytes(buffer, file.type);
  if (!magicResult.valid) {
    return error("ValidationError", magicResult.error.message, 400);
  }

  // Generate safe storage path
  const ext = path.extname(file.name) || "";
  const safeName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
  const taskDir = path.join(UPLOAD_ROOT, id);
  const storagePath = path.join(id, safeName);
  const fullPath = path.join(taskDir, safeName);

  // Ensure directory exists and write file
  await mkdir(taskDir, { recursive: true });
  await writeFile(fullPath, Buffer.from(arrayBuffer));

  // Create DB record
  const attachment = await prisma.taskAttachment.create({
    data: {
      taskId: id,
      fileName: file.name,
      fileSize: file.size,
      mimeType: file.type,
      storagePath,
      uploaderId: session.user.id,
    },
    include: {
      uploader: { select: { id: true, name: true } },
    },
  });

  return success(attachment, 201);
});

/**
 * DELETE /api/tasks/:id/attachments
 *
 * Body: { attachmentId: string }
 */
export const DELETE = withAuth(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const session = await requireAuth();
  const { id } = await context.params;

  let body: { attachmentId?: string };
  try {
    body = await req.json();
  } catch {
    return error("ParseError", "Invalid JSON body", 400);
  }

  if (!body.attachmentId) {
    return error("ValidationError", "attachmentId is required", 400);
  }

  const attachment = await prisma.taskAttachment.findUnique({
    where: { id: body.attachmentId },
  });

  if (!attachment || attachment.taskId !== id) {
    return error("NotFound", "附件不存在", 404);
  }

  // Only uploader, MANAGER, or ADMIN can delete
  const callerRole = session.user.role ?? "ENGINEER";
  if (
    attachment.uploaderId !== session.user.id &&
    callerRole !== "MANAGER" &&
    callerRole !== "ADMIN"
  ) {
    return error("ForbiddenError", "只有上傳者或管理員可以刪除附件", 403);
  }

  // Delete file from disk — validate path stays within UPLOAD_ROOT (Issue #1207)
  try {
    const resolved = path.resolve(UPLOAD_ROOT, attachment.storagePath);
    if (!resolved.startsWith(UPLOAD_ROOT)) {
      return error("ValidationError", "Invalid storage path", 400);
    }
    await unlink(resolved);
  } catch {
    // File may already be gone — proceed with DB cleanup
  }

  await prisma.taskAttachment.delete({
    where: { id: body.attachmentId },
  });

  return success({ success: true });
});
