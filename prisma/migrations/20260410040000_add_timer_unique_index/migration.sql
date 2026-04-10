-- Partial unique index: at most one running timer per user (Issue #1287)
-- Prisma doesn't support partial unique indexes natively, so this is raw SQL.
-- Ensures the TOCTOU race condition in startTimer() is caught at the DB level.
CREATE UNIQUE INDEX IF NOT EXISTS "time_entries_user_running_unique"
ON "time_entries" ("userId") WHERE "isRunning" = true AND "isDeleted" = false;
