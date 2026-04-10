-- CreateTable: monitoring_alerts (MonitoringAlert model)
-- This table was previously created via prisma db push without a migration file.

-- Create AlertStatus enum if not exists
DO $$ BEGIN
  CREATE TYPE "AlertStatus" AS ENUM ('FIRING', 'RESOLVED', 'ACKNOWLEDGED');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Create table
CREATE TABLE IF NOT EXISTS "monitoring_alerts" (
    "id" TEXT NOT NULL,
    "alertName" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "status" "AlertStatus" NOT NULL DEFAULT 'FIRING',
    "source" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT,
    "labels" JSONB,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3),
    "acknowledgedBy" TEXT,
    "acknowledgedAt" TIMESTAMP(3),
    "relatedTaskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitoring_alerts_pkey" PRIMARY KEY ("id")
);

-- Indexes
CREATE INDEX IF NOT EXISTS "monitoring_alerts_status_idx" ON "monitoring_alerts"("status");
CREATE INDEX IF NOT EXISTS "monitoring_alerts_startsAt_idx" ON "monitoring_alerts"("startsAt");

-- Foreign key (skip if already exists from db push)
DO $$ BEGIN
  ALTER TABLE "monitoring_alerts" ADD CONSTRAINT "monitoring_alerts_relatedTaskId_fkey"
      FOREIGN KEY ("relatedTaskId") REFERENCES "tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
