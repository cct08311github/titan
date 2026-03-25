/**
 * GET /api/outline/auth-redirect
 *
 * Verifies the TITAN session and redirects to Outline.
 * This ensures users cannot access Outline without being authenticated
 * in TITAN first. When OIDC (Keycloak) is configured in Phase 2,
 * the shared session will eliminate the need for double login.
 *
 * For now, this acts as an authenticated gateway that:
 * 1. Checks TITAN session (401 if not logged in)
 * 2. Redirects to the Outline URL configured via OUTLINE_INTERNAL_URL
 *
 * Issue #258
 */
import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/auth-middleware";

const OUTLINE_URL = process.env.OUTLINE_INTERNAL_URL || "/outline";

export const GET = withAuth(async (_req: NextRequest) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return NextResponse.redirect(new URL(OUTLINE_URL, _req.url)) as any;
});
