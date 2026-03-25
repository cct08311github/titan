/**
 * Page tests: Settings — Issue #506
 *
 * Covers:
 *  - Renders heading and tabs
 *  - Loading state
 *  - Error state with retry
 *  - Profile tab: name field, email disabled, role badge
 *  - Notifications tab: toggle switches
 *  - Security tab: change password link
 */
import React from "react";
import { render, screen, waitFor, act, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: "u1", name: "Alice", role: "MEMBER" }, expires: "2099" },
    status: "authenticated",
  })),
}));

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(() => ({ push: jest.fn(), replace: jest.fn() })),
  usePathname: jest.fn(() => "/settings"),
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let SettingsPage: React.ComponentType<any>;
beforeAll(async () => {
  const mod = await import("@/app/(app)/settings/page");
  SettingsPage = mod.default;
});

const USER_PROFILE = {
  id: "u1",
  name: "Alice",
  email: "alice@test.com",
  role: "MEMBER",
  avatar: null,
};

const NOTIFICATION_PREFS = [
  { id: "p1", type: "TASK_ASSIGNED", enabled: true },
  { id: "p2", type: "TASK_DUE_SOON", enabled: false },
];

function setupFetchSuccess() {
  mockFetch.mockImplementation((url: string) => {
    if (url.includes("/api/auth/session")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ user: { id: "u1", name: "Alice", role: "MEMBER" } }),
      } as Response);
    }
    if (url.includes("/notification-preferences")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: NOTIFICATION_PREFS }),
      } as Response);
    }
    if (url.includes("/api/users/")) {
      return Promise.resolve({
        ok: true,
        json: async () => ({ data: USER_PROFILE }),
      } as Response);
    }
    return Promise.resolve({ ok: true, json: async () => ({}) } as Response);
  });
}

describe("Settings Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("shows loading state initially", async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    await act(async () => { render(<SettingsPage />); });
    expect(screen.getByText("載入設定...")).toBeInTheDocument();
  });

  it("renders heading and all tabs after load", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("個人設定")).toBeInTheDocument();
      expect(screen.getByText("個人資料")).toBeInTheDocument();
      expect(screen.getByText("通知偏好")).toBeInTheDocument();
      expect(screen.getByText("安全設定")).toBeInTheDocument();
    });
  });

  it("shows profile tab by default with name input", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("姓名")).toBeInTheDocument();
      const nameInput = screen.getByDisplayValue("Alice");
      expect(nameInput).toBeInTheDocument();
    });
  });

  it("shows email as disabled", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      const emailInput = screen.getByDisplayValue("alice@test.com");
      expect(emailInput).toBeDisabled();
    });
  });

  it("shows role badge", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("工程師")).toBeInTheDocument();
    });
  });

  it("shows error state on fetch failure", async () => {
    mockFetch.mockResolvedValue({ ok: false } as Response);
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
  });

  it("switches to notifications tab", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("個人設定")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("通知偏好"));
    });
    await waitFor(() => {
      expect(screen.getByText("選擇要接收的通知類型")).toBeInTheDocument();
      expect(screen.getByText("任務指派")).toBeInTheDocument();
      expect(screen.getByText("任務即將到期")).toBeInTheDocument();
    });
  });

  it("switches to security tab", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("個人設定")).toBeInTheDocument();
    });
    await act(async () => {
      fireEvent.click(screen.getByText("安全設定"));
    });
    await waitFor(() => {
      expect(screen.getByText("變更密碼")).toBeInTheDocument();
      expect(screen.getByText("前往變更密碼")).toBeInTheDocument();
    });
  });

  it("handles save profile button", async () => {
    setupFetchSuccess();
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("儲存變更")).toBeInTheDocument();
    });
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({}) } as Response);
    await act(async () => {
      fireEvent.click(screen.getByText("儲存變更"));
    });
  });

  it("handles retry on error", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false } as Response);
    await act(async () => { render(<SettingsPage />); });
    await waitFor(() => {
      expect(screen.getByText("發生錯誤")).toBeInTheDocument();
    });
    setupFetchSuccess();
    const retryBtn = screen.getByText("重試");
    await act(async () => { fireEvent.click(retryBtn); });
    await waitFor(() => {
      expect(screen.getByText("個人設定")).toBeInTheDocument();
    });
  });
});
