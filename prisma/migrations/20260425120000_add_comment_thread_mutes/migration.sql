-- Add CommentThreadMute table + CommentThreadTarget enum (Issue #1527)
-- Lets users mute auto-subscribed thread notifications per target without
-- having to globally disable TASK_COMMENTED.

DO $$ BEGIN
  CREATE TYPE "CommentThreadTarget" AS ENUM ('TASK', 'DOCUMENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "comment_thread_mutes" (
  "id"         TEXT NOT NULL,
  "userId"     TEXT NOT NULL,
  "targetType" "CommentThreadTarget" NOT NULL,
  "targetId"   TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comment_thread_mutes_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "comment_thread_mutes"
    ADD CONSTRAINT "comment_thread_mutes_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "comment_thread_mutes_userId_targetType_targetId_key"
  ON "comment_thread_mutes" ("userId", "targetType", "targetId");

CREATE INDEX IF NOT EXISTS "comment_thread_mutes_userId_idx"
  ON "comment_thread_mutes" ("userId");
