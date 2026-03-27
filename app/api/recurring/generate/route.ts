/**
 * POST /api/recurring/generate — Trigger automatic task generation
 *
 * Scans all active RecurringRules with nextDueAt <= now,
 * creates corresponding Tasks, and advances nextDueAt.
 * Idempotent: same-day calls do not create duplicates.
 *
 * MANAGER+ only — prevents Engineers from triggering task auto-generation.
 *
 * Issue #862: Recurring Tasks
 */

import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { RecurringService } from "@/services/recurring-service";
import { success } from "@/lib/api-response";
import { withManager } from "@/lib/auth-middleware";

export const POST = withManager(async (_req: NextRequest) => {
  const service = new RecurringService(prisma);
  const now = new Date();
  const result = await service.generateTasks(now);

  return success({
    generated: result.generated,
    tasks: result.rules,
    checkedAt: now.toISOString(),
  });
});
