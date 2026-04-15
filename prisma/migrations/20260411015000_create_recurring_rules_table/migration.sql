-- Migration: create_recurring_rules_table
-- Issue #1463
--
-- Backfills the missing CREATE TABLE migration for the RecurringRule model.
-- The table was originally created via `prisma db push` in production, so
-- no migration file ever existed. CI `migrate deploy` against a fresh DB
-- therefore failed at 20260411020000_add_missing_fk_and_indexes, which
-- assumes the table already exists.
--
-- Guards (CREATE TABLE IF NOT EXISTS + DO block for enum + DO block for FKs)
-- make this safe to apply against legacy databases that already have the
-- table/enum/constraints from the original `db push`.

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Enum RecurrenceFrequency (idempotent)
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    CREATE TYPE "RecurrenceFrequency" AS ENUM ('DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Table recurring_rules
--
-- estimatedHours intentionally uses DOUBLE PRECISION here; a later migration
-- (20260411020000_add_missing_fk_and_indexes) converts it to DECIMAL(5,2).
-- ──────────────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS "recurring_rules" (
    "id" TEXT NOT NULL,
    "templateId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" "TaskCategory" NOT NULL DEFAULT 'ADMIN',
    "priority" "Priority" NOT NULL DEFAULT 'P2',
    "assigneeId" TEXT,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "monthOfYear" INTEGER,
    "timeOfDay" TEXT,
    "estimatedHours" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastGeneratedAt" TIMESTAMP(3),
    "nextDueAt" TIMESTAMP(3),
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_rules_pkey" PRIMARY KEY ("id")
);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Index isActive + nextDueAt
--
-- The assigneeId index is created by 20260411020000_add_missing_fk_and_indexes.
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "recurring_rules_isActive_nextDueAt_idx" ON "recurring_rules"("isActive", "nextDueAt");

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. FK: recurring_rules.creatorId → users.id (RESTRICT)
--
-- The assigneeId FK is added by 20260411020000_add_missing_fk_and_indexes.
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_creatorId_fkey"
      FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. FK: recurring_rules.templateId → task_templates.id (SET NULL)
-- ──────────────────────────────────────────────────────────────────────────────
DO $$ BEGIN
    ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_templateId_fkey"
      FOREIGN KEY ("templateId") REFERENCES "task_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;
