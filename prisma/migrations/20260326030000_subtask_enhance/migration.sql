-- AlterTable (Issue #856)
ALTER TABLE "sub_tasks" ADD COLUMN "notes" TEXT;
ALTER TABLE "sub_tasks" ADD COLUMN "result" TEXT;
ALTER TABLE "sub_tasks" ADD COLUMN "completedAt" TIMESTAMP(3);
