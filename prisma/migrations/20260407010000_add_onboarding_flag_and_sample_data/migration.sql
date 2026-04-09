-- Migration: 20260407010000_add_onboarding_flag_and_sample_data
-- Issue #1315: Add hasCompletedOnboarding flag to User
-- Issue #1317: Add isSample flag to Task, AnnualPlan, Project

-- User: onboarding completion flag
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "hasCompletedOnboarding" BOOLEAN NOT NULL DEFAULT false;

-- Task: sample data flag
ALTER TABLE "tasks" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN NOT NULL DEFAULT false;

-- AnnualPlan: sample data flag
ALTER TABLE "annual_plans" ADD COLUMN IF NOT EXISTS "isSample" BOOLEAN NOT NULL DEFAULT false;
