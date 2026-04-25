/**
 * Public Feature Flags — Issue #1516
 *
 * GET /api/feature-flags/public — read PUBLIC_FLAGS for any authenticated user.
 *
 * The admin endpoint at /api/admin/feature-flags returns every flag and is
 * locked to ADMIN role; this endpoint complements it for client-side
 * useFeatureFlag() which runs in pages rendered to all roles.
 */
import { NextRequest } from "next/server";
import { success } from "@/lib/api-response";
import { withAuth } from "@/lib/auth-middleware";
import { getPublicFeatureFlags } from "@/lib/feature-flags";

export const GET = withAuth(async (_req: NextRequest) => {
  const flags = await getPublicFeatureFlags();
  return success({ flags });
});
