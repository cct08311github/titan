import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { success } from "@/lib/api-response";

/**
 * GET /api/documents/verification-due — List documents needing verification (Issue #968, #1002)
 *
 * Uses verifyByDate field (auto-calculated from verifiedAt + verifyIntervalDays)
 * for efficient querying instead of computing in JS.
 *
 * Returns documents where:
 * - verifyIntervalDays is set AND
 * - verifyByDate <= now (expired) OR verifyByDate is null (never verified)
 *
 * Optional ?userId= to filter for a specific verifier.
 */
export const GET = withAuth(async (req: NextRequest) => {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get("userId");

  // Get all documents with verification configured, using verifyByDate for query
  const docs = await prisma.document.findMany({
    where: { deletedAt: null,
      verifyIntervalDays: { not: null },
      ...(userId && { verifierId: userId }),
    },
    select: {
      id: true,
      title: true,
      slug: true,
      verifierId: true,
      verifiedAt: true,
      verifyIntervalDays: true,
      verifyByDate: true,
      updatedAt: true,
      verifier: { select: { id: true, name: true } },
      creator: { select: { id: true, name: true } },
    },
    orderBy: { verifyByDate: "asc" },
  });

  const now = new Date();
  const items = docs.map((doc) => {
    // Prefer verifyByDate; fallback to computing from verifiedAt + interval
    const dueDate = doc.verifyByDate
      ?? (doc.verifiedAt && doc.verifyIntervalDays
        ? new Date(doc.verifiedAt.getTime() + doc.verifyIntervalDays * 86400000)
        : null);
    const isExpired = !doc.verifiedAt || (dueDate && dueDate <= now);
    const isNearDue = dueDate && !isExpired
      ? (dueDate.getTime() - now.getTime()) < 7 * 86400000 // within 7 days
      : false;

    return {
      ...doc,
      dueDate,
      status: isExpired ? "expired" : isNearDue ? "needs_review" : "verified",
    };
  });

  // Sort: expired first, then needs_review, then verified
  const priority: Record<string, number> = { expired: 0, needs_review: 1, verified: 2 };
  items.sort((a, b) => (priority[a.status] ?? 99) - (priority[b.status] ?? 99));

  const summary = {
    total: items.length,
    expired: items.filter((i) => i.status === "expired").length,
    needsReview: items.filter((i) => i.status === "needs_review").length,
    verified: items.filter((i) => i.status === "verified").length,
  };

  return success({ items, summary });
});
