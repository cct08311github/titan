-- Fix documents.status column type (Issue #1481)
--
-- The 20260327000000_add_missing_columns migration created the column
-- as TEXT, but the Prisma schema declares it as DocumentStatus. Under
-- Prisma 6 the mismatch was tolerated (driver let string = text compare
-- work); Prisma 7 + @prisma/adapter-pg surfaces the mismatch as:
--     DriverAdapterError: operator does not exist: text = "DocumentStatus"
-- which cascades into the alerts polling storm described in #1481.
--
-- The DocumentStatus enum type already exists in the database (created
-- alongside the TEXT column in the same migration). We only need to
-- retype the column; existing data already uses the enum value names.
--
-- Safe on both fresh and existing databases:
--   - prisma db push prod: already has DocumentStatus enum, column is TEXT
--   - migrate deploy CI:   same state
--   - fresh migrate deploy: same state
--
-- USING clause handles the cast explicitly for existing rows.

DO $$
DECLARE
  current_type text;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'documents' AND column_name = 'status';

  IF current_type = 'text' THEN
    ALTER TABLE "documents"
      ALTER COLUMN "status" DROP DEFAULT,
      ALTER COLUMN "status" TYPE "DocumentStatus"
        USING "status"::"DocumentStatus",
      ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"DocumentStatus";
  END IF;
END $$;
