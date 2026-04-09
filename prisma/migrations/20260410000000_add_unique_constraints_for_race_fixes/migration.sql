-- Migration: add unique constraints to prevent race conditions (Issue #1353)

-- Fix 2: AnnualPlan year uniqueness — prevents concurrent createPlan creating
-- duplicate year records between findFirst check and create.
CREATE UNIQUE INDEX IF NOT EXISTS "annual_plans_year_key" ON "annual_plans"("year");

-- Fix 4: MonitoringAlert composite unique — enables atomic upsert on
-- (alertName, startsAt) instead of non-atomic findFirst + create/update.
CREATE UNIQUE INDEX IF NOT EXISTS "monitoring_alerts_alertName_startsAt_key" ON "monitoring_alerts"("alertName", "startsAt");
