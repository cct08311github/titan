-- CreateTable
CREATE TABLE "time_entry_templates" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "taskId" TEXT,
    "category" "TimeCategory" NOT NULL DEFAULT 'PLANNED_TASK',
    "hours" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "time_entry_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "time_entry_templates_userId_idx" ON "time_entry_templates"("userId");

-- AddForeignKey
ALTER TABLE "time_entry_templates" ADD CONSTRAINT "time_entry_templates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "time_entry_templates" ADD CONSTRAINT "time_entry_templates_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
