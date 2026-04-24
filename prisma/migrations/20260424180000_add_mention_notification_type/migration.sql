-- Add MENTION to NotificationType enum (Issue #1506)
--
-- Enables @mention-driven notifications on comments. Guarded with
-- IF NOT EXISTS so this is idempotent across fresh `prisma migrate deploy`
-- and existing prod databases already aligned via `prisma db push`
-- (see memory project_titan_prod_db_push_baseline).
--
-- ALTER TYPE ... ADD VALUE cannot run inside a transaction block on
-- PostgreSQL < 12; Prisma wraps migrations in BEGIN/COMMIT, so we use
-- the DO block pattern with EXCEPTION to tolerate a concurrent add
-- that may have landed via db push.

DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'MENTION';
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;
