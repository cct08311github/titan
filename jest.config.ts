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
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  // Allow Docker/CI to override the default test timeout
  testTimeout: parseInt(process.env.TEST_TIMEOUT ?? "10000", 10),
};

export default config;
