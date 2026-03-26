-- Phase 2: Timesheet Approval Schema
-- Issue #850: TimesheetApproval model + TimeEntry.approvalStatus

-- 1. Create TimesheetApprovalStatus enum
CREATE TYPE "TimesheetApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- 2. Add approvalStatus to time_entries
ALTER TABLE "time_entries" ADD COLUMN "approvalStatus" "TimesheetApprovalStatus" NOT NULL DEFAULT 'PENDING';

-- 3. Migrate existing locked=true entries to APPROVED
UPDATE "time_entries" SET "approvalStatus" = 'APPROVED' WHERE "locked" = true;

-- 4. Create timesheet_approvals table
CREATE TABLE "timesheet_approvals" (
    "id" TEXT NOT NULL,
    "timeEntryId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "status" "TimesheetApprovalStatus" NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "timesheet_approvals_pkey" PRIMARY KEY ("id")
);

-- 5. Create indexes
CREATE INDEX "timesheet_approvals_timeEntryId_idx" ON "timesheet_approvals"("timeEntryId");
CREATE INDEX "timesheet_approvals_reviewerId_idx" ON "timesheet_approvals"("reviewerId");

-- 6. Add foreign keys
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_timeEntryId_fkey" FOREIGN KEY ("timeEntryId") REFERENCES "time_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "timesheet_approvals" ADD CONSTRAINT "timesheet_approvals_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 7. Add TIMESHEET_REJECTED to NotificationType enum
ALTER TYPE "NotificationType" ADD VALUE 'TIMESHEET_REJECTED';
