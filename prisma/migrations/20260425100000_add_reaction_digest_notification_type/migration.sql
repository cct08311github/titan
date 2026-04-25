-- Add REACTION_DIGEST to NotificationType enum (Issue #1520)
-- Idempotent: works on fresh migrate deploy and existing prod (db push).
DO $$
BEGIN
  ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'REACTION_DIGEST';
EXCEPTION
  WHEN duplicate_object THEN null;
END
$$;
