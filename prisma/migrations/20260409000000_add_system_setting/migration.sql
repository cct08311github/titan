-- CreateTable: system_settings (T1313)
-- Key/value store for admin-configurable system parameters.
-- Use IF NOT EXISTS for idempotency (avoids CI failure if table was created via db push).

CREATE TABLE IF NOT EXISTS "system_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "system_settings_pkey" PRIMARY KEY ("key")
);
