-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "OvertimeType" AS ENUM ('NONE', 'WEEKDAY', 'HOLIDAY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable: TimeEntry - add sortOrder and overtimeType
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "time_entries" ADD COLUMN IF NOT EXISTS "overtimeType" "OvertimeType" NOT NULL DEFAULT 'NONE';

-- CreateTable: TimeEntryTemplateItem (Phase 1 structured templates)
CREATE TABLE IF NOT EXISTS "time_entry_template_items" (
    "id" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "taskId" TEXT,
    "hours" DOUBLE PRECISION NOT NULL,
    "category" "TimeCategory" NOT NULL DEFAULT 'PLANNED_TASK',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "time_entry_template_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "time_entry_template_items_templateId_idx" ON "time_entry_template_items"("templateId");
CREATE INDEX IF NOT EXISTS "time_entries_userId_date_idx" ON "time_entries"("userId", "date");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "time_entry_template_items" ADD CONSTRAINT "time_entry_template_items_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "time_entry_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
