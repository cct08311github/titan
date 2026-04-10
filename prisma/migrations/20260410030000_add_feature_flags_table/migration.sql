-- CreateTable
CREATE TABLE IF NOT EXISTS "feature_flags" (
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "feature_flags_pkey" PRIMARY KEY ("key")
);
