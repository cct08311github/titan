import { NextRequest } from "next/server";
import { withManager } from "@/lib/auth-middleware";
import { requireAuth } from "@/lib/rbac";
import { success, error } from "@/lib/api-response";
import { getPushProvider } from "@/lib/push-notification";
import type { PushRecipient, PushMessage } from "@/lib/push-notification";

/**
 * POST /api/notifications/push
 *
 * Issue #379: 行信 API 推播通知 — Stub endpoint
 *
 * Manager-only endpoint to send push notifications to specified users.
 * Currently uses StubPushProvider (logs only, no actual delivery).
 *
 * Request body:
 *   {
 *     recipients: [{ userId: string, externalId?: string }],
 *     message: { title: string, body: string, link?: string, priority?: "normal" | "high" }
 *   }
 *
 * Returns:
 *   { ok: true, data: { success: boolean, messageId?: string, providerAvailable: boolean } }
 */
export const POST = withManager(async (req: NextRequest) => {
  await requireAuth();

  let body: { recipients?: PushRecipient[]; message?: PushMessage };
  try {
    body = await req.json();
  } catch {
    return error("ParseError", "Invalid JSON body", 400);
  }

  const { recipients, message } = body;

  if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
    return error("ValidationError", "recipients must be a non-empty array", 400);
  }

  if (!message || !message.title || !message.body) {
    return error("ValidationError", "message.title and message.body are required", 400);
  }

  const provider = getPushProvider();
  const result = await provider.send(recipients, message);

  return success({
    ...result,
    providerAvailable: provider.isAvailable(),
  });
});
