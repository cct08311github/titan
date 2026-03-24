import { execFileSync } from 'child_process';

const DB_HOST = process.env.DB_HOST ?? 'localhost';
const DB_PORT = process.env.DB_PORT ?? '5433';
const DB_NAME = process.env.DB_NAME ?? 'titandb';
const DB_USER = process.env.DB_USER ?? 'titan';
const DB_PASS = process.env.DB_PASS ?? 'titan';

/** Execute a SQL statement against the test DB (parameterized, no shell injection). */
function execSql(sql: string): void {
  execFileSync(
    'psql',
    [
      '-h', DB_HOST,
      '-p', DB_PORT,
      '-U', DB_USER,
      '-d', DB_NAME,
      '-c', sql,
    ],
    {
      stdio: 'pipe',
      env: { ...process.env, PGPASSWORD: DB_PASS },
    }
  );
}

/**
 * Re-seed the database by truncating volatile tables using execFileSync
 * (avoids shell injection by passing args as array).
 *
 * @deprecated Use resetDatabase() for a complete reset.
 */
export function truncateTimeEntries() {
  try {
    execSql('TRUNCATE TABLE "TimeEntry" CASCADE;');
  } catch {
    // Ignore — test data may already be in a clean state
  }
}

/**
 * Reset all business tables while preserving the users table
 * (auth storageState depends on existing users).
 *
 * Tables are truncated in dependency order (leaf tables first)
 * with CASCADE to handle any remaining FK constraints.
 *
 * Call this in beforeAll() of any spec that performs write operations,
 * so each test suite starts from a clean, deterministic state.
 */
export async function resetDatabase(): Promise<void> {
  // Tables ordered from leaf → root to minimise FK conflicts.
  // CASCADE handles any remaining references automatically.
  const tables = [
    // Leaf-level: no outgoing FKs to business tables
    '"TaskComment"',
    '"TaskActivity"',
    '"TaskChange"',
    '"TimeEntry"',

    // Sub-entities
    '"SubTask"',
    '"KPITaskLink"',
    '"Deliverable"',

    // Core entities
    '"Task"',
    '"KPI"',
    '"MonthlyGoal"',
    '"Milestone"',

    // Plan / document hierarchy
    '"AnnualPlan"',
    '"DocumentVersion"',
    '"Document"',

    // Infrastructure tables
    '"Notification"',
    '"Permission"',
    '"AuditLog"',
  ];

  for (const table of tables) {
    try {
      execSql(`TRUNCATE TABLE ${table} CASCADE;`);
    } catch {
      // Table may not exist in all environments — skip silently
    }
  }
}
