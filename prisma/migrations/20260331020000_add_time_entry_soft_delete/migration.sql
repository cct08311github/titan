-- Catch-up migration: time_entries soft delete columns
-- isDeleted + deletedAt were added via db push without a migration file.
-- Banking compliance: financial records must be retained (soft delete only).

ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "isDeleted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "time_entries_isDeleted_idx" ON "time_entries"("isDeleted");
