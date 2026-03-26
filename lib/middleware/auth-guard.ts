/**
 * Auth Guard helper — Issue #799 (AU-6)
 *
 * Reusable helpers for API route handlers to extract and validate
 * user context from the JWT token.
 */

import { auth } from "@/auth";
import { UnauthorizedError } from "@/services/errors";

export interface UserContext {
  userId: string;
  role: string;
  email?: string;
  name?: string;
}

/**
 * Extract user context from the current session.
 * Throws UnauthorizedError if no valid session exists.
 *
 * Usage in route handlers:
 *   const user = await getUserContext();
 *   // user.userId, user.role are guaranteed
 */
export async function getUserContext(): Promise<UserContext> {
  const session = await auth();
  if (!session?.user) {
    throw new UnauthorizedError("未授權：請先登入");
  }

  const user = session.user as {
    id?: string;
    role?: string;
    email?: string;
    name?: string;
  };

  if (!user.id || !user.role) {
    throw new UnauthorizedError("未授權：session 無效");
  }

  return {
    userId: user.id,
    role: user.role,
    email: user.email ?? undefined,
    name: user.name ?? undefined,
  };
}

/**
 * Try to extract user context without throwing.
 * Returns null if no valid session exists.
 */
export async function tryGetUserContext(): Promise<UserContext | null> {
  try {
    return await getUserContext();
  } catch {
    return null;
  }
}
