import { execFileSync } from 'child_process';

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = process.env.DB_PORT ?? '5433';
const DB_NAME = process.env.DB_NAME ?? 'titandb';
const DB_USER = process.env.DB_USER ?? 'titan';
const DB_PASS = process.env.DB_PASS ?? 'titan';

/**
 * Re-seed the database by truncating volatile tables using execFileSync
 * (avoids shell injection by passing args as array).
 */
export function truncateTimeEntries() {
  try {
    execFileSync(
      'psql',
      [
        '-h', DB_HOST,
        '-p', DB_PORT,
        '-U', DB_USER,
        '-d', DB_NAME,
        '-c', 'TRUNCATE TABLE "TimeEntry" CASCADE;',
      ],
      {
        stdio: 'pipe',
        env: { ...process.env, PGPASSWORD: DB_PASS },
      }
    );
  } catch {
    // Ignore — test data may already be in a clean state
  }
}
