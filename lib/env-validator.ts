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
}
