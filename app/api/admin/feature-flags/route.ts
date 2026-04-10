/**
 * Feature Flags API — Issue #1328
 *
 * GET  /api/admin/feature-flags — read all flags (any authenticated user)
 * PUT  /api/admin/feature-flags — update a flag (ADMIN only)
 */
import { NextRequest } from "next/server";
import { success } from "@/lib/api-response";
import { withAdmin } from "@/lib/auth-middleware";
import { getAllFeatureFlags, setFeatureFlag, isValidFlagName } from "@/lib/feature-flags";
import { requireAuth } from "@/lib/rbac";
import { ValidationError } from "@/services/errors";

export const GET = withAdmin(async (_req: NextRequest) => {
  const flags = await getAllFeatureFlags();
  return success({ flags });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const session = await requireAuth();
  const body = await req.json();
  const { name, enabled } = body;

  if (!name || typeof enabled !== "boolean") {
    throw new ValidationError("需提供 name (string) 和 enabled (boolean)");
  }

  if (!isValidFlagName(name)) {
    throw new ValidationError(`未知的 feature flag: ${name}`);
  }

  await setFeatureFlag(name, enabled, session.user.id);

  const flags = await getAllFeatureFlags();
  return success({ flags });
});
