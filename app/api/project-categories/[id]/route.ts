import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";
import { NotFoundError, ConflictError } from "@/services/errors";
import { z } from "zod";
import { validateBody } from "@/lib/validate";

const updateCategorySchema = z.object({
  name: z.string().min(1).max(50).optional(),
  sortOrder: z.number().int().optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /api/project-categories/[id]
 * Update a category (MANAGER only).
 */
export const PATCH = withManager(async (
  req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;
  const raw = await req.json();
  const body = validateBody(updateCategorySchema, raw);

  const existing = await prisma.projectCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("類別不存在");
  }

  // Check name uniqueness if changing name
  if (body.name && body.name !== existing.name) {
    const dup = await prisma.projectCategory.findUnique({
      where: { name: body.name },
    });
    if (dup) {
      throw new ConflictError("類別名稱已存在");
    }
  }

  const updated = await prisma.projectCategory.update({
    where: { id },
    data: body,
  });

  return success(updated);
});

/**
 * DELETE /api/project-categories/[id]
 * Soft-delete a category by setting isActive=false (MANAGER only).
 */
export const DELETE = withManager(async (
  _req: NextRequest,
  context: { params: Promise<Record<string, string>> }
) => {
  const { id } = await context.params;

  const existing = await prisma.projectCategory.findUnique({ where: { id } });
  if (!existing) {
    throw new NotFoundError("類別不存在");
  }

  await prisma.projectCategory.update({
    where: { id },
    data: { isActive: false },
  });

  return success({ success: true });
});
