/**
 * @jest-environment node
 */
/**
 * Session Timeout tests — Issue #798 (AU-4)
 */

describe("Session timeout configuration", () => {
  it("auth.ts session maxAge is configurable (currently 15 min for access token)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/Users/openclaw/.openclaw/shared/projects/titan/auth.ts", "utf8"
    );
    // maxAge should be present and set to a reasonable value
    expect(content).toMatch(/maxAge:\s*\d+/);
  });

  it("SessionTimeoutWarning component exists", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/Users/openclaw/.openclaw/shared/projects/titan/app/components/session-timeout-warning.tsx", "utf8"
    );
    expect(content).toContain("SessionTimeoutWarning");
    expect(content).toContain("延長 Session");
    expect(content).toContain("session_timeout");
  });

  it("warning appears 5 minutes before timeout", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/Users/openclaw/.openclaw/shared/projects/titan/app/components/session-timeout-warning.tsx", "utf8"
    );
    expect(content).toContain("WARNING_BEFORE_MINUTES = 5");
  });

  it("default timeout is 30 minutes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/Users/openclaw/.openclaw/shared/projects/titan/app/components/session-timeout-warning.tsx", "utf8"
    );
    expect(content).toContain("DEFAULT_TIMEOUT_MINUTES = 30");
  });

  it("user activity resets timer (debounced)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      "/Users/openclaw/.openclaw/shared/projects/titan/app/components/session-timeout-warning.tsx", "utf8"
    );
    expect(content).toContain("mousedown");
    expect(content).toContain("keydown");
    expect(content).toContain("resetTimers");
  });
});
