-- AlterTable: add subTaskId to TimeEntry with onDelete SetNull (#935)
ALTER TABLE "time_entries" ADD COLUMN "subTaskId" TEXT;

-- CreateIndex
CREATE INDEX "time_entries_subTaskId_idx" ON "time_entries"("subTaskId");

-- AddForeignKey
ALTER TABLE "time_entries"
  ADD CONSTRAINT "time_entries_subTaskId_fkey"
  FOREIGN KEY ("subTaskId") REFERENCES "sub_tasks"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
