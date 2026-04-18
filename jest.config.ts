import type { Config } from "jest";

/**
 * Jest configuration — unified for Docker and local environments.
 *
 * Environment variables:
 *   DATABASE_URL — overridden in CI / Docker (see .env.example)
 *   TEST_TIMEOUT — optional, default 10000ms
 */

const config: Config = {
  testEnvironment: "jsdom",
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  // Issue #1486: db-integration suites need a real Postgres and run via
  // `npm run test:db` with a dedicated config. Exclude them here so the
  // default Jest run (mocked Prisma) doesn't pick them up.
  testPathIgnorePatterns: ["/node_modules/", "/__tests__/db-integration/"],
  collectCoverageFrom: [
    "services/**/*.ts",
    "!services/**/__tests__/**",
    "!services/**/index.ts",
  ],
  transform: {
    "^.+\\.(t|j)sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: {
            syntax: "typescript",
            tsx: true,
            decorators: false,
          },
          transform: {
            react: {
              runtime: "automatic",
            },
          },
        },
      },
    ],
  },
  // ESM-only packages — must be transformed by SWC
  // next-auth v5, @auth/core, Prisma 7 client runtime deps,
  // and isomorphic-dompurify transitive deps (#1326)
  transformIgnorePatterns: [
    "/node_modules/(?!(next-auth|@auth/core|@panva/hkdf|jose|oauth4webapi|preact-render-to-string|preact|@paralleldrive|@prisma/client-engine-runtime|@exodus)/)",
  ],
  modulePathIgnorePatterns: ["<rootDir>/.claude/worktrees/"],
  setupFiles: ["<rootDir>/jest.polyfills.ts"],
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Allow Docker/CI to override the default test timeout
  testTimeout: parseInt(process.env.TEST_TIMEOUT ?? "10000", 10),
};

export default config;
