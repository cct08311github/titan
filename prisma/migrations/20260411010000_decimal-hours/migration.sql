-- AlterTable: Task.estimatedHours Float? -> Decimal(5,2)?
ALTER TABLE "tasks" ALTER COLUMN "estimatedHours" TYPE DECIMAL(5,2) USING "estimatedHours"::DECIMAL(5,2);

-- AlterTable: Task.actualHours Float -> Decimal(5,2)
ALTER TABLE "tasks" ALTER COLUMN "actualHours" TYPE DECIMAL(5,2) USING "actualHours"::DECIMAL(5,2);

-- AlterTable: TimeEntry.hours Float -> Decimal(5,2)
ALTER TABLE "time_entries" ALTER COLUMN "hours" TYPE DECIMAL(5,2) USING "hours"::DECIMAL(5,2);

-- AlterTable: TimeEntryTemplateItem.hours Float -> Decimal(5,2)
ALTER TABLE "time_entry_template_items" ALTER COLUMN "hours" TYPE DECIMAL(5,2) USING "hours"::DECIMAL(5,2);
