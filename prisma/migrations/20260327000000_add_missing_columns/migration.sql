-- Add AuditLog.module and AuditLog.metadata and AuditLog.userAgent (Sprint 4 AF-1)
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "module" TEXT NOT NULL DEFAULT 'AUTH';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "userAgent" TEXT;

-- Add Task.managerFlagged + flagReason + flaggedAt + flaggedBy (Phase A flag mechanism)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "managerFlagged" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "flagReason" TEXT;
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "flaggedAt" TIMESTAMP(3);
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "flaggedBy" TEXT;

-- Add Task.annualPlanId (Sprint 7 A-4)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "annualPlanId" TEXT;

-- Add Task.position (Sprint 5 K-1 drag sort)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "position" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add AnnualPlan.vision + archivedAt (Sprint 6 + P1)
ALTER TABLE "annual_plans" ADD COLUMN IF NOT EXISTS "vision" TEXT;
ALTER TABLE "annual_plans" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

-- Add MonthlyGoal.assigneeId + completedAt + retrospectiveNote (Sprint 6 + P1)
ALTER TABLE "monthly_goals" ADD COLUMN IF NOT EXISTS "assigneeId" TEXT;
ALTER TABLE "monthly_goals" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);
ALTER TABLE "monthly_goals" ADD COLUMN IF NOT EXISTS "retrospectiveNote" TEXT;

-- Add AnnualPlan.progressPct (auto-rollup)
ALTER TABLE "annual_plans" ADD COLUMN IF NOT EXISTS "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add MonthlyGoal.progressPct (auto-rollup)
ALTER TABLE "monthly_goals" ADD COLUMN IF NOT EXISTS "progressPct" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- Add Task.slaDeadline (DT Phase 2)
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "slaDeadline" TIMESTAMP(3);

-- Add Document.status + spaceId + verifierId + verifiedAt + verifyIntervalDays (Knowledge v2)
DO $$ BEGIN
  CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED', 'RETIRED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "spaceId" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "verifierId" TEXT;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "verifiedAt" TIMESTAMP(3);
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "verifyIntervalDays" INTEGER;

-- Create KnowledgeSpace table
CREATE TABLE IF NOT EXISTS "knowledge_spaces" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_spaces_pkey" PRIMARY KEY ("id")
);

-- Create SpaceMember table
CREATE TABLE IF NOT EXISTS "space_members" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'VIEWER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "space_members_pkey" PRIMARY KEY ("id")
);

-- Create KnowledgeCategory table
CREATE TABLE IF NOT EXISTS "knowledge_categories" (
    "id" TEXT NOT NULL,
    "spaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_categories_pkey" PRIMARY KEY ("id")
);

-- Create DocumentAttachment table
CREATE TABLE IF NOT EXISTS "document_attachments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "mimeType" TEXT NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_attachments_pkey" PRIMARY KEY ("id")
);

-- Create DocumentComment table
CREATE TABLE IF NOT EXISTS "document_comments" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_comments_pkey" PRIMARY KEY ("id")
);

-- Create DocumentReadLog table
CREATE TABLE IF NOT EXISTS "document_read_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_read_logs_pkey" PRIMARY KEY ("id")
);

-- Create DocumentLink table
CREATE TABLE IF NOT EXISTS "document_links" (
    "id" TEXT NOT NULL,
    "sourceDocId" TEXT NOT NULL,
    "targetDocId" TEXT NOT NULL,
    "linkType" TEXT NOT NULL DEFAULT 'REFERENCE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_links_pkey" PRIMARY KEY ("id")
);

-- Create ReadingList tables
CREATE TABLE IF NOT EXISTS "reading_lists" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdBy" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "reading_lists_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reading_list_items" (
    "id" TEXT NOT NULL,
    "readingListId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "reading_list_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "reading_list_assignments" (
    "id" TEXT NOT NULL,
    "readingListId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "assignedBy" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    CONSTRAINT "reading_list_assignments_pkey" PRIMARY KEY ("id")
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "space_members_spaceId_idx" ON "space_members"("spaceId");
CREATE INDEX IF NOT EXISTS "space_members_userId_idx" ON "space_members"("userId");
CREATE INDEX IF NOT EXISTS "knowledge_categories_spaceId_idx" ON "knowledge_categories"("spaceId");
CREATE INDEX IF NOT EXISTS "document_attachments_documentId_idx" ON "document_attachments"("documentId");
CREATE INDEX IF NOT EXISTS "document_comments_documentId_idx" ON "document_comments"("documentId");
CREATE INDEX IF NOT EXISTS "document_read_logs_documentId_idx" ON "document_read_logs"("documentId");
CREATE INDEX IF NOT EXISTS "document_links_sourceDocId_idx" ON "document_links"("sourceDocId");
CREATE INDEX IF NOT EXISTS "document_links_targetDocId_idx" ON "document_links"("targetDocId");
CREATE INDEX IF NOT EXISTS "reading_list_items_readingListId_idx" ON "reading_list_items"("readingListId");
CREATE INDEX IF NOT EXISTS "reading_list_assignments_readingListId_idx" ON "reading_list_assignments"("readingListId");
CREATE INDEX IF NOT EXISTS "reading_list_assignments_userId_idx" ON "reading_list_assignments"("userId");
