-- Issue #1440: Add composite indexes for performance
-- Using CONCURRENTLY to avoid locking in production; IF NOT EXISTS for idempotency

CREATE INDEX CONCURRENTLY IF NOT EXISTS "annual_plans_archivedAt_year_idx" ON "annual_plans" ("archivedAt", "year");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "kpis_year_status_idx" ON "kpis" ("year", "status");
CREATE INDEX CONCURRENTLY IF NOT EXISTS "notifications_userId_type_isRead_idx" ON "notifications" ("userId", "type", "isRead");

-- Note: "time_entries_date_isDeleted_idx" already exists (@@index([date, isDeleted]) in schema)
-- No new index needed for TimeEntry.
