/**
 * Jest config for real-Postgres integration tests (Issue #1486).
 *
 * Run via: `npm run test:db`
 *
 * These tests require DATABASE_URL and are skipped automatically if unset.
 * Kept separate from the main Jest config because:
 *   - testEnvironment must be `node`, not `jsdom`
 *   - testPathIgnorePatterns are narrower (only db-integration suites)
 *   - slower to run, should not block the main watch loop
 */

module.exports = {
  testEnvironment: "node",
  testMatch: ["<rootDir>/__tests__/db-integration/**/*.test.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transform: {
    "^.+\\.(ts|tsx)$": ["ts-jest", { tsconfig: "tsconfig.json" }],
  },
  setupFilesAfterEnv: [],
  forceExit: true,
  // No coverage on these — they're contract tests, not unit tests.
  collectCoverage: false,
};
