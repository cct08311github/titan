/**
 * @file docker-build-verify.test.ts
 * TDD tests for scripts/docker-build-verify.sh
 *
 * Validates that the verification script:
 * 1. Exists and is executable
 * 2. Contains required verification steps
 * 3. Supports both ARM64 and x86_64 platforms
 * 4. Checks image size thresholds
 * 5. Verifies Prisma client generation
 */

import { existsSync, readFileSync, statSync } from "fs";
import { join } from "path";

const SCRIPT_PATH = join(
  process.cwd(),
  "scripts",
  "docker-build-verify.sh"
);

describe("docker-build-verify.sh", () => {
  it("should exist", () => {
    expect(existsSync(SCRIPT_PATH)).toBe(true);
  });

  it("should be executable", () => {
    const stats = statSync(SCRIPT_PATH);
    // Check owner execute bit (0o100)
    expect(stats.mode & 0o100).toBeTruthy();
  });

  describe("script content", () => {
    let content: string;

    beforeAll(() => {
      content = readFileSync(SCRIPT_PATH, "utf-8");
    });

    it("should have a bash shebang", () => {
      expect(content.startsWith("#!/usr/bin/env bash") || content.startsWith("#!/bin/bash")).toBe(true);
    });

    it("should use strict mode (set -euo pipefail)", () => {
      expect(content).toContain("set -euo pipefail");
    });

    it("should support ARM64 platform", () => {
      expect(content).toMatch(/linux\/arm64/);
    });

    it("should support x86_64 platform", () => {
      expect(content).toMatch(/linux\/amd64/);
    });

    it("should define an image size threshold", () => {
      // Script should check that image size is under a reasonable limit
      expect(content).toMatch(/MAX_SIZE|max_size|size.*threshold|IMAGE_SIZE_LIMIT/i);
    });

    it("should verify Prisma client generation", () => {
      expect(content).toMatch(/prisma/i);
    });

    it("should build using the project Dockerfile", () => {
      expect(content).toMatch(/docker\s+build/);
    });

    it("should include cleanup of test images", () => {
      expect(content).toMatch(/docker\s+(rmi|image\s+rm)/);
    });

    it("should output a summary or result", () => {
      expect(content).toMatch(/PASS|FAIL|SUCCESS|SUMMARY|summary|結果/i);
    });
  });
});
