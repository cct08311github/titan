-- AddColumn: dashboardLayout to users table
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "dashboardLayout" JSONB NOT NULL DEFAULT '[]';
