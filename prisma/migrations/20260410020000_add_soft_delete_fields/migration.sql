-- Migration: add_soft_delete_fields (Issue #1324)
-- Adds deletedAt DateTime? to Task, TaskComment, Document, KPI
-- Uses ADD COLUMN IF NOT EXISTS for idempotent deployment

-- tasks
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "tasks_deletedAt_idx" ON "tasks"("deletedAt");

-- task_comments
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "task_comments_deletedAt_idx" ON "task_comments"("deletedAt");

-- kpis
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "kpis_deletedAt_idx" ON "kpis"("deletedAt");

-- documents
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
CREATE INDEX IF NOT EXISTS "documents_deletedAt_idx" ON "documents"("deletedAt");
