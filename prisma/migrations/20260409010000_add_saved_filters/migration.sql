-- Issue #1325: Add savedFilters column to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "savedFilters" JSONB NOT NULL DEFAULT '[]';
