-- CreateEnum
CREATE TYPE "OvertimeType" AS ENUM ('NONE', 'WEEKDAY', 'HOLIDAY');

-- AlterTable: TimeEntry - add sortOrder and overtimeType
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "overtimeType" "OvertimeType" NOT NULL DEFAULT 'NONE';

-- AlterTable: TimeEntryTemplateItem - add sortOrder
ALTER TABLE "time_entry_template_items" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "time_entries_userId_date_idx" ON "time_entries"("userId", "date");
