-- Catch-up migration: add MilestoneType enum and type column to milestones
-- These were added via db push and never had a corresponding migration file.
-- Uses IF NOT EXISTS guards for idempotency (safe to run on both new and existing DBs).

DO $$ BEGIN
  CREATE TYPE "MilestoneType" AS ENUM ('LAUNCH', 'AUDIT', 'CUSTOM');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "milestones"
  ADD COLUMN IF NOT EXISTS "type" "MilestoneType" NOT NULL DEFAULT 'CUSTOM';
