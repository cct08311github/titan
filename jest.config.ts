import type { Config } from "jest";
import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

const config: Config = {
  coverageProvider: "v8",
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!app/**/_*.{ts,tsx}",
    "!app/**/layout.tsx",
    "!app/**/globals.css",
    "!**/*.d.ts",
    "!**/node_modules/**",
  ],
  testMatch: ["<rootDir>/__tests__/**/*.{test,spec}.{ts,tsx}"],
  // Per-file environment overrides
  testEnvironmentOptions: {},
};

export default createJestConfig(config);
