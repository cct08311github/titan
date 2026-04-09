/**
 * POST /api/cron/stale-task-scan — Stale task detection cron (Issue #1311)
 *
 * Scans all non-terminal tasks for staleness and creates Notification records
 * for assignees, managers, and admins based on stale thresholds.
 *
 * Protected by CRON_SECRET header validation (required if env var is set).
 * Edge JWT middleware also blocks unauthenticated external requests.
 */

import { NextRequest } from "next/server";
import { success, error } from "@/lib/api-response";
import { apiHandler } from "@/lib/api-handler";
import { scanStaleTasks } from "@/services/stale-task-service";
import { logger } from "@/lib/logger";
import { verifyCronSecret } from "@/lib/cron-auth";

export const POST = apiHandler(async (req: NextRequest) => {
  const authError = verifyCronSecret(req);
  if (authError) return authError;

  try {
    const result = await scanStaleTasks();
    logger.info(
      { ...result },
      "[stale-task-scan] scan completed"
    );
    return success({
      ...result,
      scannedAt: new Date().toISOString(),
    });
  } catch (err) {
    logger.error({ err }, "[stale-task-scan] scan failed");
    return error("ServerError", "Stale task scan failed", 500);
  }
});
