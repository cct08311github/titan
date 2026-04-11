-- Partial unique index: enforce at most one running timer per user at the DB level.
-- This prevents TOCTOU race conditions where two concurrent requests both pass
-- the application-level check and create duplicate running timers.
-- Prisma does not support partial unique indexes natively, so this is a raw SQL migration.
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS "time_entries_userId_running_unique"
ON time_entries ("userId") WHERE "isRunning" = true;
