-- Migration: add_missing_fk_and_indexes
-- Adds missing FK constraints, composite indexes, and Float→Decimal conversions
-- Issue #1435

-- ──────────────────────────────────────────────────────────────────────────────
-- 1. Float→Decimal: kpi_achievements.actual_value
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "kpi_achievements" ALTER COLUMN "actualValue" TYPE DECIMAL(10,4) USING "actualValue"::DECIMAL(10,4);

-- ──────────────────────────────────────────────────────────────────────────────
-- 2. Float→Decimal: task_templates.estimated_hours
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "task_templates" ALTER COLUMN "estimatedHours" TYPE DECIMAL(5,2) USING "estimatedHours"::DECIMAL(5,2);

-- ──────────────────────────────────────────────────────────────────────────────
-- 3. Float→Decimal: recurring_rules.estimated_hours
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "recurring_rules" ALTER COLUMN "estimatedHours" TYPE DECIMAL(5,2) USING "estimatedHours"::DECIMAL(5,2);

-- ──────────────────────────────────────────────────────────────────────────────
-- 4. FK: kpi_achievements.reportedBy → users.id
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "kpi_achievements" ADD CONSTRAINT "kpi_achievements_reportedBy_fkey"
  FOREIGN KEY ("reportedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 5. FK: sub_tasks.assigneeId → users.id (SET NULL on delete)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "sub_tasks" ADD CONSTRAINT "sub_tasks_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 6. FK: recurring_rules.assigneeId → users.id (SET NULL on delete)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "recurring_rules" ADD CONSTRAINT "recurring_rules_assigneeId_fkey"
  FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 7. FK: monitoring_alerts.acknowledgedBy → users.id (SET NULL on delete)
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "monitoring_alerts_acknowledgedBy_fkey"
  FOREIGN KEY ("acknowledgedBy") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────────
-- 8. Index: sub_tasks.assigneeId
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "sub_tasks_assigneeId_idx" ON "sub_tasks"("assigneeId");

-- ──────────────────────────────────────────────────────────────────────────────
-- 9. Index: recurring_rules.assigneeId
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "recurring_rules_assigneeId_idx" ON "recurring_rules"("assigneeId");

-- ──────────────────────────────────────────────────────────────────────────────
-- 10. Index: monitoring_alerts.acknowledgedBy
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "monitoring_alerts_acknowledgedBy_idx" ON "monitoring_alerts"("acknowledgedBy");

-- ──────────────────────────────────────────────────────────────────────────────
-- 11. Composite index: tasks(deletedAt, status)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "tasks_deletedAt_status_idx" ON "tasks"("deletedAt", "status");

-- ──────────────────────────────────────────────────────────────────────────────
-- 12. Composite index: tasks(monthlyGoalId, status)
-- ──────────────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS "tasks_monthlyGoalId_status_idx" ON "tasks"("monthlyGoalId", "status");
