/**
 * Page tests: Root Page (app/page.tsx)
 *
 * The root page is a Server Component that only calls redirect("/dashboard").
 * We mock next/navigation so the redirect doesn't throw and verify the module
 * exports a default function that can be called without crashing.
 */
import React from "react";

const mockRedirect = jest.fn();
jest.mock("next/navigation", () => ({
  redirect: (url: string) => {
    mockRedirect(url);
    // In test environment, redirect throws by design in Next.js.
    // We just record the call and do not throw so the component can be examined.
  },
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/"),
  useSearchParams: jest.fn(() => new URLSearchParams()),
}));

describe("Root Page (app/page.tsx)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("module exports a default function (page component)", async () => {
    const mod = await import("@/app/page");
    expect(typeof mod.default).toBe("function");
  });

  it("calls redirect to /dashboard when rendered", async () => {
    const { default: RootPage } = await import("@/app/page");
    // Server Component — just call it directly to trigger redirect
    try {
      RootPage({} as never);
    } catch {
      // redirect() may throw in some environments — that is expected
    }
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("does not render any visible content (only redirects)", async () => {
    const { default: RootPage } = await import("@/app/page");
    // The component should not return renderable JSX
    let result: unknown;
    try {
      result = RootPage({} as never);
    } catch {
      result = undefined;
    }
    // Either undefined/null (redirect threw) or void — no meaningful JSX
    expect(result == null || result === undefined).toBe(true);
  });

  it("redirect target is exactly /dashboard (not /login or /home)", async () => {
    const { default: RootPage } = await import("@/app/page");
    try { RootPage({} as never); } catch { /* expected */ }
    // Must redirect to /dashboard specifically
    expect(mockRedirect).not.toHaveBeenCalledWith("/login");
    expect(mockRedirect).not.toHaveBeenCalledWith("/home");
    expect(mockRedirect).toHaveBeenCalledWith("/dashboard");
  });

  it("redirect is called exactly once per render", async () => {
    const { default: RootPage } = await import("@/app/page");
    try { RootPage({} as never); } catch { /* expected */ }
    expect(mockRedirect).toHaveBeenCalledTimes(1);
  });
});
