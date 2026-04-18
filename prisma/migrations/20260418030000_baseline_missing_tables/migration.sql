-- Baseline migration for tables created via `prisma db push` but never migrated (#1492).
-- All statements are idempotent so this is safe on both fresh CI DBs and existing prod DBs.
-- Tables: change_records, notification_logs, project_gates, project_issues, project_risks, project_stakeholders, projects, push_tokens, reading_list_item_reads, task_attachments, task_documents

-- CreateEnum (idempotent): CMChangeType
DO $$ BEGIN
  CREATE TYPE "CMChangeType" AS ENUM ('NORMAL', 'STANDARD', 'EMERGENCY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- CreateEnum (idempotent): RiskLevel
DO $$ BEGIN
  CREATE TYPE "RiskLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- CreateEnum (idempotent): ChangeStatus
DO $$ BEGIN
  CREATE TYPE "ChangeStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'IN_PROGRESS', 'VERIFYING', 'COMPLETED', 'ROLLED_BACK', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- CreateEnum (idempotent): SpaceRole
DO $$ BEGIN
  CREATE TYPE "SpaceRole" AS ENUM ('OWNER', 'EDITOR', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- CreateEnum (idempotent): LinkType
DO $$ BEGIN
  CREATE TYPE "LinkType" AS ENUM ('REFERENCE', 'RELATED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- CreateEnum (idempotent): PushPlatform
DO $$ BEGIN
  CREATE TYPE "PushPlatform" AS ENUM ('IOS', 'ANDROID');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
-- CreateEnum (idempotent): ProjectStatus
DO $$ BEGIN
  CREATE TYPE "ProjectStatus" AS ENUM ('PROPOSED', 'EVALUATING', 'APPROVED', 'SCHEDULED', 'REQUIREMENTS', 'DESIGN', 'DEVELOPMENT', 'TESTING', 'DEPLOYMENT', 'WARRANTY', 'COMPLETED', 'POST_REVIEW', 'CLOSED', 'ON_HOLD', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddColumn: tasks.projectId (retroactive FK column, never migrated)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "projectId" TEXT;

-- Add FK from tasks.projectId to projects.id (once projects exists below)
-- This FK is guarded and will only succeed after the CREATE TABLE "projects" below.
-- The guard uses DO block so re-runs are safe.

-- CreateTable
CREATE TABLE IF NOT EXISTS "change_records" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "changeNumber" TEXT NOT NULL,
    "type" "CMChangeType" NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "impactedSystems" TEXT[],
    "scheduledStart" TIMESTAMP(3),
    "scheduledEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "rollbackPlan" TEXT,
    "verificationPlan" TEXT,
    "status" "ChangeStatus" NOT NULL DEFAULT 'DRAFT',
    "cabApprovedBy" TEXT,
    "cabApprovedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "change_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "task_documents" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "outlineDocumentId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "addedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "task_attachments" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "mimeType" TEXT NOT NULL,
    "storagePath" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "task_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_logs" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorMessage" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "reading_list_item_reads" (
    "id" TEXT NOT NULL,
    "readingListId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reading_list_item_reads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "push_tokens" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "platform" "PushPlatform" NOT NULL,
    "deviceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "push_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "projects" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "subCategory" TEXT,
    "tags" TEXT[],
    "requestDept" TEXT NOT NULL,
    "requestContact" TEXT,
    "requestPhone" TEXT,
    "requestDate" TIMESTAMP(3),
    "businessGoal" TEXT,
    "coDepts" TEXT[],
    "coContacts" TEXT[],
    "devDept" TEXT,
    "ownerId" TEXT NOT NULL,
    "leadDevId" TEXT,
    "teamMembers" TEXT[],
    "benefitRevenue" INTEGER,
    "benefitCompliance" INTEGER,
    "benefitEfficiency" INTEGER,
    "benefitRisk" INTEGER,
    "benefitScore" INTEGER,
    "benefitNote" TEXT,
    "benefitEvaluator" TEXT,
    "benefitDate" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'P2',
    "urgency" TEXT DEFAULT 'MEDIUM',
    "strategicAlign" INTEGER,
    "priorityScore" INTEGER,
    "priorityNote" TEXT,
    "feasibility" TEXT DEFAULT 'PENDING',
    "feasibilityNote" TEXT,
    "techComplexity" TEXT,
    "techStack" TEXT,
    "dependencies" TEXT,
    "constraints" TEXT,
    "assumptions" TEXT,
    "riskLevel" TEXT DEFAULT 'MEDIUM',
    "riskNote" TEXT,
    "feasibilityBy" TEXT,
    "feasibilityDate" TIMESTAMP(3),
    "mdProjectMgmt" DOUBLE PRECISION DEFAULT 0,
    "mdRequirements" DOUBLE PRECISION DEFAULT 0,
    "mdDesign" DOUBLE PRECISION DEFAULT 0,
    "mdDevelopment" DOUBLE PRECISION DEFAULT 0,
    "mdTesting" DOUBLE PRECISION DEFAULT 0,
    "mdDeployment" DOUBLE PRECISION DEFAULT 0,
    "mdDocumentation" DOUBLE PRECISION DEFAULT 0,
    "mdTraining" DOUBLE PRECISION DEFAULT 0,
    "mdMaintenance" DOUBLE PRECISION DEFAULT 0,
    "mdOther" DOUBLE PRECISION DEFAULT 0,
    "mdTotalEstimated" DOUBLE PRECISION,
    "mdActualTotal" DOUBLE PRECISION,
    "budgetInternal" DOUBLE PRECISION DEFAULT 0,
    "budgetExternal" DOUBLE PRECISION DEFAULT 0,
    "budgetHardware" DOUBLE PRECISION DEFAULT 0,
    "budgetLicense" DOUBLE PRECISION DEFAULT 0,
    "budgetOther" DOUBLE PRECISION DEFAULT 0,
    "budgetTotal" DOUBLE PRECISION,
    "budgetActual" DOUBLE PRECISION,
    "budgetApproved" BOOLEAN NOT NULL DEFAULT false,
    "budgetApprovalNo" TEXT,
    "costPerManDay" DOUBLE PRECISION DEFAULT 5000,
    "vendor" TEXT,
    "vendorContact" TEXT,
    "vendorContract" TEXT,
    "vendorAmount" DOUBLE PRECISION,
    "vendorStartDate" TIMESTAMP(3),
    "vendorEndDate" TIMESTAMP(3),
    "subVendors" TEXT[],
    "plannedStart" TIMESTAMP(3),
    "plannedEnd" TIMESTAMP(3),
    "actualStart" TIMESTAMP(3),
    "actualEnd" TIMESTAMP(3),
    "goLiveDate" TIMESTAMP(3),
    "warrantyEndDate" TIMESTAMP(3),
    "status" "ProjectStatus" NOT NULL DEFAULT 'PROPOSED',
    "phase" TEXT,
    "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "progressNote" TEXT,
    "blockers" TEXT,
    "nextSteps" TEXT,
    "progressUpdatedAt" TIMESTAMP(3),
    "currentGate" TEXT,
    "gateStatus" TEXT DEFAULT 'PENDING',
    "postReviewSchedule" INTEGER,
    "postReviewQuality" INTEGER,
    "postReviewBudget" INTEGER,
    "postReviewSatisfy" INTEGER,
    "postReviewScore" INTEGER,
    "postReviewNote" TEXT,
    "lessonsLearned" TEXT,
    "improvements" TEXT,
    "postReviewBy" TEXT,
    "postReviewDate" TIMESTAMP(3),
    "approvalStatus" TEXT DEFAULT 'PENDING',
    "approvedBy" TEXT,
    "approvedDate" TIMESTAMP(3),
    "approvalNo" TEXT,
    "relatedRegulation" TEXT,
    "internalNote" TEXT,
    "createdBy" TEXT NOT NULL,
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_risks" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "probability" TEXT NOT NULL,
    "impact" TEXT NOT NULL,
    "riskScore" INTEGER,
    "mitigation" TEXT,
    "contingency" TEXT,
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "dueDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_risks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_issues" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "severity" TEXT NOT NULL,
    "assigneeId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "resolution" TEXT,
    "dueDate" TIMESTAMP(3),
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_stakeholders" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department" TEXT,
    "role" TEXT,
    "influence" TEXT,
    "interest" TEXT,
    "engagement" TEXT,
    "commStrategy" TEXT,
    "contactInfo" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_stakeholders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "project_gates" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "checklist" JSONB,
    "checklistPassed" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "blockerNote" TEXT,
    "waiverReason" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "project_gates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "change_records_taskId_key" ON "change_records"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "change_records_changeNumber_key" ON "change_records"("changeNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "change_records_status_idx" ON "change_records"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_documents_taskId_idx" ON "task_documents"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "task_documents_taskId_outlineDocumentId_key" ON "task_documents"("taskId", "outlineDocumentId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_attachments_taskId_idx" ON "task_attachments"("taskId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "task_attachments_uploaderId_idx" ON "task_attachments"("uploaderId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_notificationId_idx" ON "notification_logs"("notificationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "notification_logs_recipient_idx" ON "notification_logs"("recipient");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "reading_list_item_reads_readingListId_userId_idx" ON "reading_list_item_reads"("readingListId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "reading_list_item_reads_readingListId_documentId_userId_key" ON "reading_list_item_reads"("readingListId", "documentId", "userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "push_tokens_userId_idx" ON "push_tokens"("userId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "push_tokens_isActive_idx" ON "push_tokens"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "push_tokens_deviceId_key" ON "push_tokens"("deviceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "projects_code_key" ON "projects"("code");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_ownerId_idx" ON "projects"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_year_idx" ON "projects"("year");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_status_idx" ON "projects"("status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_requestDept_idx" ON "projects"("requestDept");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "projects_priority_idx" ON "projects"("priority");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_risks_projectId_idx" ON "project_risks"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_risks_ownerId_idx" ON "project_risks"("ownerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_issues_projectId_idx" ON "project_issues"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_issues_assigneeId_idx" ON "project_issues"("assigneeId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_stakeholders_projectId_idx" ON "project_stakeholders"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_gates_projectId_idx" ON "project_gates"("projectId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_gates_reviewerId_idx" ON "project_gates"("reviewerId");

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "tasks" ADD CONSTRAINT "tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "change_records" ADD CONSTRAINT "change_records_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "task_documents" ADD CONSTRAINT "task_documents_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "task_attachments" ADD CONSTRAINT "task_attachments_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "reading_list_item_reads" ADD CONSTRAINT "reading_list_item_reads_readingListId_fkey" FOREIGN KEY ("readingListId") REFERENCES "reading_lists"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "reading_list_item_reads" ADD CONSTRAINT "reading_list_item_reads_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "reading_list_item_reads" ADD CONSTRAINT "reading_list_item_reads_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "push_tokens" ADD CONSTRAINT "push_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "projects" ADD CONSTRAINT "projects_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_risks" ADD CONSTRAINT "project_risks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_issues" ADD CONSTRAINT "project_issues_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_stakeholders" ADD CONSTRAINT "project_stakeholders_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey (idempotent)
DO $$ BEGIN
  ALTER TABLE "project_gates" ADD CONSTRAINT "project_gates_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
