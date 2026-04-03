import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success } from "@/lib/api-response";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { ConflictError } from "@/services/errors";
import { z } from "zod";
import { validateBody } from "@/lib/validate";

const createCategorySchema = z.object({
  name: z.string().min(1, "類別名稱為必填").max(50),
  sortOrder: z.number().int().optional(),
});

/**
 * GET /api/project-categories
 * List all active categories sorted by sortOrder.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const includeInactive = searchParams.get("includeInactive") === "true";

  const categories = await prisma.projectCategory.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  return success(categories);
});

/**
 * POST /api/project-categories
 * Create a new category (MANAGER only).
 */
export const POST = withManager(async (req: NextRequest) => {
  const raw = await req.json();
  const body = validateBody(createCategorySchema, raw);

  const existing = await prisma.projectCategory.findUnique({
    where: { name: body.name },
  });
  if (existing) {
    throw new ConflictError("類別名稱已存在");
  }

  const maxOrder = await prisma.projectCategory.aggregate({
    _max: { sortOrder: true },
  });

  const category = await prisma.projectCategory.create({
    data: {
      name: body.name,
      sortOrder: body.sortOrder ?? (maxOrder._max.sortOrder ?? 0) + 1,
    },
  });

  return success(category, 201);
});
