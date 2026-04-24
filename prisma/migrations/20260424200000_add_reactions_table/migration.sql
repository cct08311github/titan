-- Add Reactions table + ReactionTarget enum (Issue #1512)
--
-- Lightweight emoji reactions on task comments, document comments, and
-- activity timeline items. Fixed 6-emoji set validated at the API layer;
-- emoji column stays TEXT to allow the set to evolve without a schema
-- migration.
--
-- Guarded so this is idempotent across fresh `prisma migrate deploy` and
-- existing prod databases (titan prod runs `db push`, see memory
-- project_titan_prod_db_push_baseline).

DO $$ BEGIN
  CREATE TYPE "ReactionTarget" AS ENUM ('TASK_COMMENT', 'DOCUMENT_COMMENT', 'ACTIVITY');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "reactions" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "targetType" "ReactionTarget" NOT NULL,
  "targetId"   TEXT NOT NULL,
  "emoji"      TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "reactions"
    ADD CONSTRAINT "reactions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "reactions_userId_targetType_targetId_emoji_key"
  ON "reactions" ("userId", "targetType", "targetId", "emoji");

CREATE INDEX IF NOT EXISTS "reactions_targetType_targetId_idx"
  ON "reactions" ("targetType", "targetId");

CREATE INDEX IF NOT EXISTS "reactions_userId_createdAt_idx"
  ON "reactions" ("userId", "createdAt");
