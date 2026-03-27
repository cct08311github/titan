/**
 * Feature Flags API — Issue #988
 *
 * GET  /api/admin/feature-flags — read all flags (any authenticated user)
 * PUT  /api/admin/feature-flags — update a flag (ADMIN only)
 */
import { NextRequest } from "next/server";
import { success } from "@/lib/api-response";
import { withAuth, withAdmin } from "@/lib/auth-middleware";
import { getAllFeatureFlags, isValidFlagName } from "@/lib/feature-flags";
import { ValidationError } from "@/services/errors";

export const GET = withAuth(async (_req: NextRequest) => {
  const flags = getAllFeatureFlags();
  return success({ flags });
});

export const PUT = withAdmin(async (req: NextRequest) => {
  const body = await req.json();
  const { name, enabled } = body;

  if (!name || typeof enabled !== "boolean") {
    throw new ValidationError("需提供 name (string) 和 enabled (boolean)");
  }

  if (!isValidFlagName(name)) {
    throw new ValidationError(`未知的 feature flag: ${name}`);
  }

  // Set the env var at runtime (in-memory only, persists until restart)
  const envKey = `TITAN_FF_${name}`;
  process.env[envKey] = enabled ? "true" : "false";

  const flags = getAllFeatureFlags();
  return success({ flags });
});
