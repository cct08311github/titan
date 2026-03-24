import { NextRequest } from "next/server";

/**
 * Extracts the client IP address from a Next.js request.
 * Checks x-forwarded-for first (proxy/load balancer), then x-real-ip.
 * Returns null if neither header is present.
 */
export function getClientIp(req: NextRequest): string | null {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip")?.trim() ??
    null
  );
}
