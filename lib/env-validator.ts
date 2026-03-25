/**
 * Validate required environment variables at startup.
 * Called from instrumentation.ts so the app fails fast with a clear message
 * instead of crashing later with cryptic errors.
 */

interface EnvRule {
  /** At least one of these env var names must be set. */
  keys: string[];
  /** Human-readable description shown on failure. */
  label: string;
}

const REQUIRED_ENV: EnvRule[] = [
  {
    keys: ["DATABASE_URL"],
    label: "Database connection string (DATABASE_URL)",
  },
  {
    keys: ["AUTH_SECRET", "NEXTAUTH_SECRET"],
    label: "Auth secret (AUTH_SECRET or NEXTAUTH_SECRET)",
  },
  {
    keys: ["AUTH_URL", "NEXTAUTH_URL"],
    label: "Auth URL (AUTH_URL or NEXTAUTH_URL)",
  },
];

/**
 * Optional env vars that are validated when present (non-empty = valid).
 * A warning is emitted at startup if these are missing, but the app still starts.
 */
const OPTIONAL_ENV: EnvRule[] = [
  {
    keys: ["REDIS_URL"],
    label: "Redis connection URL (REDIS_URL) — required for rate limiting, session limiter, JWT blacklist",
  },
  {
    keys: ["OUTLINE_INTERNAL_URL"],
    label: "Outline wiki internal URL (OUTLINE_INTERNAL_URL) — required for knowledge base integration",
  },
  {
    keys: ["PINO_LOG_LEVEL"],
    label: "Log level (PINO_LOG_LEVEL) — defaults to 'info' if unset",
  },
  {
    keys: ["MAX_CONCURRENT_SESSIONS"],
    label: "Max concurrent sessions per user (MAX_CONCURRENT_SESSIONS) — defaults to 2",
  },
];

export function validateEnv(): void {
  const missing: string[] = [];

  for (const rule of REQUIRED_ENV) {
    const found = rule.keys.some(
      (key) => process.env[key] && process.env[key]!.trim() !== ""
    );
    if (!found) {
      missing.push(`  - ${rule.label} [${rule.keys.join(" | ")}]`);
    }
  }

  if (missing.length > 0) {
    const message = [
      "",
      "=== TITAN: Missing required environment variables ===",
      ...missing,
      "",
      "The application cannot start without these variables.",
      "Check your .env file or deployment environment configuration.",
      "=====================================================",
      "",
    ].join("\n");

    console.error(message);
    throw new Error(
      `Missing required environment variables: ${missing.length} rule(s) failed. See log above.`
    );
  }

  // Check optional env vars and warn if missing
  const warnings: string[] = [];
  for (const rule of OPTIONAL_ENV) {
    const found = rule.keys.some(
      (key) => process.env[key] && process.env[key]!.trim() !== ""
    );
    if (!found) {
      warnings.push(`  - ${rule.label} [${rule.keys.join(" | ")}]`);
    }
  }

  if (warnings.length > 0) {
    const message = [
      "",
      "=== TITAN: Optional environment variables not set ===",
      ...warnings,
      "",
      "The application will start, but some features may be degraded.",
      "=====================================================",
      "",
    ].join("\n");

    console.warn(message);
  }
}
