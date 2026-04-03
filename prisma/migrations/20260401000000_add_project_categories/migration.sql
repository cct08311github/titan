-- CreateTable
CREATE TABLE IF NOT EXISTS "project_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "project_categories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "project_categories_name_key" ON "project_categories"("name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "project_categories_isActive_sortOrder_idx" ON "project_categories"("isActive", "sortOrder");

-- Seed default categories
INSERT INTO "project_categories" ("id", "name", "sortOrder") VALUES
    ('cat-01', '一行一策', 1),
    ('cat-02', '戰略任務', 2),
    ('cat-03', '法規遵循', 3),
    ('cat-04', '數位轉型', 4),
    ('cat-05', '基礎設施', 5),
    ('cat-06', '資安強化', 6),
    ('cat-07', '營運改善', 7),
    ('cat-08', '系統優化', 8),
    ('cat-09', '新建系統', 9)
ON CONFLICT ("name") DO NOTHING;
