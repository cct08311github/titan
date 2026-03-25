/**
 * GET/PUT /api/users/:id/notification-preferences — Issue #267
 *
 * GET: Returns the user's notification preferences (defaults to all enabled).
 * PUT: Updates notification preferences for the user.
 *
 * Authorization: User can only manage their own preferences.
 * Managers can view/update any user's preferences.
 */
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { withAuth } from "@/lib/auth-middleware";
import { requireAuth, requireRole } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { RouteContext } from "@/lib/api-handler";
import { NotificationType } from "@prisma/client";

const ALL_TYPES = Object.values(NotificationType);

export const GET = withAuth(async (req: NextRequest, context?: RouteContext) => {
  const session = await requireAuth();
  const { id } = await context!.params;

  // Users can only view their own preferences; Managers can view anyone's
  if (session.user.id !== id) {
    await requireRole("MANAGER");
  }

  const prefs = await prisma.notificationPreference.findMany({
    where: { userId: id },
  });

  // Build full preference map, defaulting to enabled for unset types
  const prefMap = new Map(prefs.map((p) => [p.type, p.enabled]));
  const preferences = ALL_TYPES.map((type) => ({
    type,
    enabled: prefMap.get(type) ?? true,
  }));

  return success({ preferences });
});

export const PUT = withAuth(async (req: NextRequest, context?: RouteContext) => {
  const session = await requireAuth();
  const { id } = await context!.params;

  if (session.user.id !== id) {
    await requireRole("MANAGER");
  }

  let body: { preferences?: Array<{ type: string; enabled: boolean }> };
  try {
    body = await req.json();
  } catch {
    return error("ValidationError", "無效的請求格式", 400);
  }

  if (!body.preferences || !Array.isArray(body.preferences)) {
    return error("ValidationError", "請提供 preferences 陣列", 400);
  }

  // Validate all types
  for (const pref of body.preferences) {
    if (!ALL_TYPES.includes(pref.type as NotificationType)) {
      return error("ValidationError", `無效的通知類型: ${pref.type}`, 400);
    }
  }

  // Upsert each preference
  const results = await Promise.all(
    body.preferences.map((pref) =>
      prisma.notificationPreference.upsert({
        where: {
          userId_type: { userId: id, type: pref.type as NotificationType },
        },
        update: { enabled: pref.enabled },
        create: {
          userId: id,
          type: pref.type as NotificationType,
          enabled: pref.enabled,
        },
      })
    )
  );

  const preferences = results.map((r) => ({
    type: r.type,
    enabled: r.enabled,
  }));

  return success({ preferences });
});
