import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { success, error } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import type { Prisma } from "@prisma/client";
import { parsePage, parseLimit } from "@/lib/query-params";

const VALID_CATEGORIES = ["PLANNED", "ADDED", "INCIDENT", "SUPPORT", "ADMIN", "LEARNING"];
const VALID_STATUSES = ["BACKLOG", "TODO", "IN_PROGRESS", "REVIEW", "DONE"];
const VALID_PRIORITIES = ["P0", "P1", "P2", "P3"];
const VALID_SORT_FIELDS = ["title", "createdAt", "updatedAt", "dueDate", "priority", "status", "category"];

/**
 * GET /api/reports/custom — Issue #861
 *
 * Custom query API with date range, multi-select filters, field selection,
 * pagination, and sorting.
 *
 * Query params:
 *   from, to (required) — date range
 *   dateField — createdAt (default) or completedAt (maps to updatedAt where status=DONE)
 *   category — comma-separated categories
 *   status — comma-separated statuses
 *   priority — comma-separated priorities
 *   assignee — comma-separated user IDs
 *   fields — comma-separated field names to include
 *   page, limit — pagination (default page=1, limit=50)
 *   sort, order — sorting (default sort=createdAt, order=desc)
 */
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");

  if (!from || !to) {
    return error("ValidationError", "from 和 to 日期範圍為必填", 400);
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);

  if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
    return error("ValidationError", "日期格式不正確", 400);
  }

  if (fromDate > toDate) {
    return error("ValidationError", "起始日期不可晚於結束日期", 400);
  }

  // Parse filters
  const categoryParam = searchParams.get("category");
  const statusParam = searchParams.get("status");
  const priorityParam = searchParams.get("priority");
  const assigneeParam = searchParams.get("assignee");
  const dateField = searchParams.get("dateField") ?? "createdAt";
  const fieldsParam = searchParams.get("fields");

  // Validate enum values
  const categories = categoryParam
    ? categoryParam.split(",").filter((c) => VALID_CATEGORIES.includes(c))
    : [];
  const statuses = statusParam
    ? statusParam.split(",").filter((s) => VALID_STATUSES.includes(s))
    : [];
  const priorities = priorityParam
    ? priorityParam.split(",").filter((p) => VALID_PRIORITIES.includes(p))
    : [];
  const assignees = assigneeParam
    ? assigneeParam.split(",").filter(Boolean)
    : [];

  // Pagination
  const page = parsePage(searchParams.get("page"));
  const limit = parseLimit(searchParams.get("limit"), 50, 200);
  const skip = (page - 1) * limit;

  // Sorting
  const sortField = searchParams.get("sort") ?? "createdAt";
  const sortOrder = searchParams.get("order") === "asc" ? "asc" : "desc";
  const orderBy: Record<string, string> = {};
  if (VALID_SORT_FIELDS.includes(sortField)) {
    orderBy[sortField] = sortOrder;
  } else {
    orderBy.createdAt = sortOrder;
  }

  // Build where clause
  const where: Prisma.TaskWhereInput = {};

  // Date range filter
  const toDateEnd = new Date(toDate);
  toDateEnd.setHours(23, 59, 59, 999);

  if (dateField === "completedAt") {
    // For completed date, filter by updatedAt where status is DONE
    where.updatedAt = { gte: fromDate, lte: toDateEnd };
    where.status = "DONE";
  } else {
    where.createdAt = { gte: fromDate, lte: toDateEnd };
  }

  if (categories.length > 0) {
    where.category = { in: categories as ("PLANNED" | "ADDED" | "INCIDENT" | "SUPPORT" | "ADMIN" | "LEARNING")[] };
  }
  if (statuses.length > 0 && dateField !== "completedAt") {
    where.status = { in: statuses as ("BACKLOG" | "TODO" | "IN_PROGRESS" | "REVIEW" | "DONE")[] };
  }
  if (priorities.length > 0) {
    where.priority = { in: priorities as ("P0" | "P1" | "P2" | "P3")[] };
  }
  if (assignees.length > 0) {
    where.primaryAssigneeId = { in: assignees };
  }

  // Permission: engineers only see their own tasks
  const isManager = session.user.role === "MANAGER";
  if (!isManager) {
    where.OR = [
      { primaryAssigneeId: session.user.id },
      { backupAssigneeId: session.user.id },
      { creatorId: session.user.id },
    ];
  }

  // Execute query
  const [total, tasks] = await Promise.all([
    prisma.task.count({ where }),
    prisma.task.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        category: true,
        status: true,
        priority: true,
        dueDate: true,
        createdAt: true,
        updatedAt: true,
        estimatedHours: true,
        actualHours: true,
        primaryAssignee: { select: { id: true, name: true } },
      },
      orderBy,
      skip,
      take: limit,
    }),
  ]);

  // Field selection: if specific fields requested, filter response
  let data = tasks;
  if (fieldsParam) {
    const fields = fieldsParam.split(",").filter(Boolean);
    data = tasks.map((t) => {
      const filtered: Record<string, unknown> = { id: t.id };
      for (const f of fields) {
        if (f in t) {
          filtered[f] = (t as Record<string, unknown>)[f];
        }
        if (f === "assignee" && t.primaryAssignee) {
          filtered.assignee = t.primaryAssignee.name;
        }
      }
      return filtered;
    }) as typeof tasks;
  }

  return success({ total, data, page, limit });
});
