-- AlterEnum: Add TIMESHEET_REMINDER to NotificationType
ALTER TYPE "NotificationType" ADD VALUE 'TIMESHEET_REMINDER';

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('TASK_STATUS_CHANGE', 'DELIVERABLE_ACCEPTANCE', 'PLAN_MODIFICATION');

-- CreateTable
CREATE TABLE "task_templates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "priority" "Priority" NOT NULL DEFAULT 'P2',
    "category" "TaskCategory" NOT NULL DEFAULT 'PLANNED',
    "estimatedHours" DOUBLE PRECISION,
    "creatorId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "task_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_requests" (
    "id" TEXT NOT NULL,
    "requesterId" TEXT NOT NULL,
    "approverId" TEXT,
    "type" "ApprovalType" NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'PENDING',
    "resourceId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "reason" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "task_templates_creatorId_idx" ON "task_templates"("creatorId");

-- CreateIndex
CREATE INDEX "approval_requests_requesterId_idx" ON "approval_requests"("requesterId");

-- CreateIndex
CREATE INDEX "approval_requests_approverId_idx" ON "approval_requests"("approverId");

-- CreateIndex
CREATE INDEX "approval_requests_status_idx" ON "approval_requests"("status");

-- CreateIndex
CREATE INDEX "approval_requests_resourceType_resourceId_idx" ON "approval_requests"("resourceType", "resourceId");

-- AddForeignKey
ALTER TABLE "task_templates" ADD CONSTRAINT "task_templates_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_requests" ADD CONSTRAINT "approval_requests_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
