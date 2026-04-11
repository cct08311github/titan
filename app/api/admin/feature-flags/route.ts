/**
 * Feature Flags API — Issue #1328
 *
 * GET  /api/admin/feature-flags — read all flags (ADMIN only)
 * PUT  /api/admin/feature-flags — update a flag (ADMIN only)
 */
import { NextRequest } from "next/server";
import { z } from "zod";
import { success } from "@/lib/api-response";
import { withAdmin } from "@/lib/auth-middleware";
import { getAllFeatureFlags, setFeatureFlag, isValidFlagName } from "@/lib/feature-flags";
import { requireAuth } from "@/lib/rbac";
import { ValidationError } from "@/services/errors";
import { validateBody } from "@/lib/validate";

const updateFeatureFlagSchema = z.object({
  name: z.string().min(1).max(100),
  enabled: z.boolean(),
});

export const GET = withAdmin(async (_req: NextRequest) => {
  const flags = await getAllFeatureFlags();
  return success({ flags });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const session = await requireAuth();
  const rawBody = await req.json();
  const { name, enabled } = validateBody(updateFeatureFlagSchema, rawBody);

  if (!isValidFlagName(name)) {
    throw new ValidationError(`未知的 feature flag: ${name}`);
  }

  await setFeatureFlag(name, enabled, session.user.id);

  const flags = await getAllFeatureFlags();
  return success({ flags });
});
