// PHASE 2 STUB — Basic CRUD only, no workflow engine
// Approval state transitions, escalation, and notifications are not implemented.
// See Issue #382 for the full approval workflow design.

import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { withAuth, withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { validateBody } from "@/lib/validate";
import { parsePagination, buildPaginationMeta } from "@/lib/pagination";
import { sanitizeHtml } from "@/lib/security/sanitize";

const createApprovalSchema = z.object({
  type: z.enum(["TASK_STATUS_CHANGE", "DELIVERABLE_ACCEPTANCE", "PLAN_MODIFICATION"]),
  resourceId: z.string().min(1),
  resourceType: z.string().min(1),
  reason: z.string().max(1000).optional(),
  approverId: z.string().optional(),
});

/**
 * GET /api/approvals?status=PENDING&type=TASK_STATUS_CHANGE
 *
 * Issue #382: 審批機制追蹤
 *
 * Returns approval requests visible to the current user:
 * - Engineers see their own requests
 * - Managers see all requests (or those assigned to them)
 */
export const GET = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();
  const { searchParams } = new URL(req.url);
  const { page, limit, skip } = parsePagination(searchParams);

  const statusFilter = searchParams.get("status");
  const typeFilter = searchParams.get("type");

  const isManager = session.user.role === "MANAGER" || session.user.role === "ADMIN";

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  // Engineers only see their own requests
  if (!isManager) {
    where.requesterId = session.user.id;
  }

  if (statusFilter) {
    where.status = statusFilter;
  }
  if (typeFilter) {
    where.type = typeFilter;
  }

  const [items, total] = await Promise.all([
    prisma.approvalRequest.findMany({
      where,
      include: {
        requester: { select: { id: true, name: true, email: true } },
        approver: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: limit,
    }),
    prisma.approvalRequest.count({ where }),
  ]);

  return success({
    items,
    pagination: buildPaginationMeta(total, { page, limit, skip }),
  });
});

/**
 * POST /api/approvals
 *
 * Create a new approval request. Any authenticated user can request approval.
 *
 * Body:
 *   { type: ApprovalType, resourceId: string, resourceType: string, reason?: string, approverId?: string }
 */
export const POST = withAuth(async (req: NextRequest) => {
  const session = await requireAuth();

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return error("ParseError", "Invalid JSON body", 400);
  }

  const { type, resourceId, resourceType, reason, approverId } = validateBody(createApprovalSchema, rawBody);

  // If approverId specified, verify it's a valid MANAGER
  if (approverId) {
    const approver = await prisma.user.findUnique({
      where: { id: approverId },
      select: { role: true },
    });
    if (!approver || approver.role !== "MANAGER") {
      return error("ValidationError", "approverId must reference a MANAGER", 400);
    }
  }

  const sanitizedReason = typeof reason === "string" && reason.trim()
    ? sanitizeHtml(reason.slice(0, 1000)) || null
    : null;

  const approval = await prisma.approvalRequest.create({
    data: {
      requesterId: session.user.id,
      approverId: approverId ?? null,
      type,
      resourceId,
      resourceType,
      reason: sanitizedReason,
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
    },
  });

  return success(approval, 201);
});

/**
 * PATCH /api/approvals
 *
 * Manager-only: approve or reject an approval request.
 *
 * Body:
 *   { id: string, status: "APPROVED" | "REJECTED", reviewNote?: string }
 */
export const PATCH = withManager(async (req: NextRequest) => {
  const session = await requireAuth();

  let body: { id?: string; status?: string; reviewNote?: string };
  try {
    body = await req.json();
  } catch {
    return error("ParseError", "Invalid JSON body", 400);
  }

  const { id, status, reviewNote } = body;

  if (!id || !status) {
    return error("ValidationError", "id and status are required", 400);
  }

  if (!["APPROVED", "REJECTED"].includes(status)) {
    return error("ValidationError", "status must be APPROVED or REJECTED", 400);
  }

  const existing = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!existing) {
    return error("NotFound", "Approval request not found", 404);
  }
  if (existing.requesterId === session.user.id) {
    return error("FORBIDDEN", "審核人不得為申請人本身", 403);
  }
  if (existing.status !== "PENDING") {
    return error("ConflictError", "Only PENDING requests can be reviewed", 409);
  }

  const sanitizedNote = typeof reviewNote === "string" && reviewNote.trim()
    ? sanitizeHtml(reviewNote.slice(0, 1000)) || null
    : null;

  const updated = await prisma.approvalRequest.update({
    where: { id },
    data: {
      status: status as "APPROVED" | "REJECTED",
      approverId: session.user.id,
      reviewNote: sanitizedNote,
      reviewedAt: new Date(),
    },
    include: {
      requester: { select: { id: true, name: true, email: true } },
      approver: { select: { id: true, name: true, email: true } },
    },
  });

  return success(updated);
});
