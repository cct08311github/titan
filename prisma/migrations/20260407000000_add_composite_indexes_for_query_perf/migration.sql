-- AddIndex: Task model composite indexes for high-frequency query patterns
CREATE INDEX IF NOT EXISTS "tasks_status_dueDate_idx" ON "tasks"("status", "dueDate");
CREATE INDEX IF NOT EXISTS "tasks_primaryAssigneeId_status_idx" ON "tasks"("primaryAssigneeId", "status");
CREATE INDEX IF NOT EXISTS "tasks_managerFlagged_status_idx" ON "tasks"("managerFlagged", "status");

-- AddIndex: TimeEntry model composite indexes
CREATE INDEX IF NOT EXISTS "time_entries_date_isDeleted_idx" ON "time_entries"("date", "isDeleted");
CREATE INDEX IF NOT EXISTS "time_entries_userId_date_isDeleted_idx" ON "time_entries"("userId", "date", "isDeleted");

-- AddIndex: Document model composite index
CREATE INDEX IF NOT EXISTS "documents_status_createdAt_idx" ON "documents"("status", "createdAt");
