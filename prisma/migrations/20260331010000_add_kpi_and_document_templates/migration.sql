-- Catch-up migration: KPI extended fields + document_templates table
-- All items were added via db push without corresponding migration files.
-- Uses IF NOT EXISTS / DO/EXCEPTION guards for idempotency.

-- ── KPIFrequency enum ─────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "KPIFrequency" AS ENUM ('MONTHLY', 'QUARTERLY', 'YEARLY');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── KPIVisibility enum ────────────────────────────────────
DO $$ BEGIN
  CREATE TYPE "KPIVisibility" AS ENUM ('ALL', 'MANAGER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── kpis extended columns ─────────────────────────────────
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "frequency"     "KPIFrequency" NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "visibility"    "KPIVisibility" NOT NULL DEFAULT 'ALL';
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "measureMethod" TEXT;
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "minValue"      DOUBLE PRECISION;
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "maxValue"      DOUBLE PRECISION;
ALTER TABLE "kpis" ADD COLUMN IF NOT EXISTS "unit"          TEXT;

-- ── kpi_achievements table ────────────────────────────────
CREATE TABLE IF NOT EXISTS "kpi_achievements" (
    "id"          TEXT NOT NULL,
    "kpiId"       TEXT NOT NULL,
    "period"      TEXT NOT NULL,
    "actualValue" DOUBLE PRECISION NOT NULL,
    "note"        TEXT,
    "reportedBy"  TEXT NOT NULL,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_achievements_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "kpi_achievements"
    ADD CONSTRAINT "kpi_achievements_kpiId_fkey"
    FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_achievements_kpiId_period_key" ON "kpi_achievements"("kpiId", "period");
CREATE INDEX IF NOT EXISTS "kpi_achievements_kpiId_idx"       ON "kpi_achievements"("kpiId");
CREATE INDEX IF NOT EXISTS "kpi_achievements_reportedBy_idx"  ON "kpi_achievements"("reportedBy");

-- ── kpi_histories table ───────────────────────────────────
CREATE TABLE IF NOT EXISTS "kpi_histories" (
    "id"        TEXT NOT NULL,
    "kpiId"     TEXT NOT NULL,
    "period"    TEXT NOT NULL,
    "actual"    DOUBLE PRECISION NOT NULL,
    "source"    TEXT,
    "updatedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "kpi_histories_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "kpi_histories"
    ADD CONSTRAINT "kpi_histories_kpiId_fkey"
    FOREIGN KEY ("kpiId") REFERENCES "kpis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "kpi_histories"
    ADD CONSTRAINT "kpi_histories_updatedBy_fkey"
    FOREIGN KEY ("updatedBy") REFERENCES "users"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "kpi_histories_kpiId_period_key" ON "kpi_histories"("kpiId", "period");
CREATE INDEX IF NOT EXISTS "kpi_histories_kpiId_idx" ON "kpi_histories"("kpiId");

-- ── document_templates table ──────────────────────────────
CREATE TABLE IF NOT EXISTS "document_templates" (
    "id"        TEXT NOT NULL,
    "title"     TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "category"  TEXT NOT NULL,
    "isSystem"  BOOLEAN NOT NULL DEFAULT false,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "document_templates_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "document_templates"
    ADD CONSTRAINT "document_templates_createdBy_fkey"
    FOREIGN KEY ("createdBy") REFERENCES "users"("id") ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "document_templates_createdBy_idx" ON "document_templates"("createdBy");
CREATE INDEX IF NOT EXISTS "document_templates_category_idx"  ON "document_templates"("category");
