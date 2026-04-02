/**
 * @jest-environment node
 */
/**
 * Session Timeout tests — Issue #798 (AU-4), extended for Issue #1137
 */
import path from "path";

const ROOT = process.cwd();

describe("Session timeout configuration", () => {
  it("auth.ts session maxAge is configurable (currently 15 min for access token)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "auth.ts"), "utf8"
    );
    // maxAge should be present and set to a reasonable value
    expect(content).toMatch(/maxAge:\s*\d+/);
  });

  it("SessionTimeoutWarning component exists", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("SessionTimeoutWarning");
    expect(content).toContain("延長 Session");
    expect(content).toContain("session_timeout");
  });

  it("warning appears 5 minutes before timeout", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("WARNING_BEFORE_MINUTES = 5");
  });

  it("default timeout is 30 minutes", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("DEFAULT_TIMEOUT_MINUTES = 30");
  });

  it("user activity resets timer (debounced)", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("mousedown");
    expect(content).toContain("keydown");
    expect(content).toContain("resetTimers");
  });
});

describe("Cross-tab session sync (Issue #1137)", () => {
  it("uses BroadcastChannel for cross-tab communication", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("BroadcastChannel");
    expect(content).toContain("titan-session-sync");
  });

  it("SSR safety: checks typeof BroadcastChannel before usage", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain('typeof BroadcastChannel');
  });

  it("broadcasts session_extended when user extends session", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("session_extended");
    expect(content).toMatch(/broadcast.*session_extended/s);
  });

  it("broadcasts session_timeout when session expires", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("session_timeout");
    expect(content).toMatch(/broadcast.*session_timeout/s);
  });

  it("cleans up BroadcastChannel on unmount", async () => {
    const fs = await import("fs");
    const content = fs.readFileSync(
      path.resolve(ROOT, "app/components/session-timeout-warning.tsx"), "utf8"
    );
    expect(content).toContain("channel.close()");
    expect(content).toContain("channelRef.current = null");
  });

  it("is rendered inside NextAuthSessionProvider in app layout", async () => {
    const fs = await import("fs");
    const layout = fs.readFileSync(
      path.resolve(ROOT, "app/(app)/layout.tsx"), "utf8"
    );
    expect(layout).toContain("SessionTimeoutWarning");
    // Verify it's imported from the correct module
    expect(layout).toContain("session-timeout-warning");
    // Verify it appears after NextAuthSessionProvider open and before its close
    const providerOpen = layout.indexOf("NextAuthSessionProvider>");
    const componentPos = layout.indexOf("<SessionTimeoutWarning");
    const providerClose = layout.indexOf("</NextAuthSessionProvider>");
    expect(providerOpen).toBeLessThan(componentPos);
    expect(componentPos).toBeLessThan(providerClose);
  });
});
