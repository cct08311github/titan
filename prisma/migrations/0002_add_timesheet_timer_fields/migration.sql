-- TS-01: Add startTime/endTime for timer mode
ALTER TABLE "time_entries" ADD COLUMN "startTime" TIMESTAMP(3);
ALTER TABLE "time_entries" ADD COLUMN "endTime" TIMESTAMP(3);

-- TS-03: Add overtime flag
ALTER TABLE "time_entries" ADD COLUMN "overtime" BOOLEAN NOT NULL DEFAULT false;

-- TS-04: Add locked flag for review locking
ALTER TABLE "time_entries" ADD COLUMN "locked" BOOLEAN NOT NULL DEFAULT false;

-- TS-05: Add isRunning flag for timer state
ALTER TABLE "time_entries" ADD COLUMN "isRunning" BOOLEAN NOT NULL DEFAULT false;

-- TS-05: Index for efficient timer lookup (one running timer per user)
CREATE INDEX "time_entries_userId_isRunning_idx" ON "time_entries"("userId", "isRunning");
