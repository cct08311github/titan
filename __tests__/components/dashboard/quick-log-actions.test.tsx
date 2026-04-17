/**
 * Component tests: quick-log-actions — Issue #1470
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock sonner toast
const mockToastSuccess = jest.fn();
const mockToastError = jest.fn();
jest.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const SUGGESTION = {
  taskId: "task-001",
  title: "設計新功能",
  estimatedHours: 2,
  suggestion: "建議投入 2 小時進行設計",
};

function makeFetchSuccess(data: unknown = { id: "entry-1" }) {
  return jest.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ ok: true, data }),
  } as Response);
}

function makeFetchError(status = 500, message = "伺服器錯誤") {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => ({ message }),
  } as unknown as Response);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("StartTimerButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders with start-timer-btn testid", async () => {
    mockFetch.mockImplementation(makeFetchSuccess());
    const onSuccess = jest.fn();

    const { StartTimerButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<StartTimerButton onSuccess={onSuccess} />);

    expect(screen.getByTestId("start-timer-btn")).toBeInTheDocument();
    expect(screen.getByText("開始計時")).toBeInTheDocument();
  });

  it("calls POST /api/time-entries/start, shows success toast, and calls onSuccess", async () => {
    mockFetch.mockImplementation(makeFetchSuccess({ id: "timer-1" }));
    const onSuccess = jest.fn();

    const { StartTimerButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<StartTimerButton taskId="task-001" onSuccess={onSuccess} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("start-timer-btn"));
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("計時器已啟動");
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);

    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("/api/time-entries/start");
    expect(callArgs[1]?.method).toBe("POST");
    expect(JSON.parse(callArgs[1]?.body as string)).toEqual({ taskId: "task-001" });
  });

  it("shows 409 conflict error toast when timer already running", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 409,
      json: async () => ({ message: "已有計時器在執行中" }),
    } as unknown as Response);
    const onSuccess = jest.fn();

    const { StartTimerButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<StartTimerButton onSuccess={onSuccess} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("start-timer-btn"));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith(
        "已有正在計時的項目，請先停止目前計時器"
      );
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("shows generic error toast on non-409 errors (no raw server message leak)", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: async () => ({ message: "內部伺服器錯誤：Prisma ... stack ..." }),
    } as unknown as Response);
    const onSuccess = jest.fn();

    const { StartTimerButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<StartTimerButton onSuccess={onSuccess} />);

    await act(async () => {
      fireEvent.click(screen.getByTestId("start-timer-btn"));
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });

    // Issue #1475: non-409 errors must use a generic fallback string,
    // not the raw server-provided message (prevents Prisma/stack leaks).
    expect(mockToastError).toHaveBeenCalledWith("無法啟動計時器，請稍後再試");
    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.stringContaining("Prisma"),
    );
    expect(mockToastError).not.toHaveBeenCalledWith(
      "已有正在計時的項目，請先停止目前計時器"
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });

  it("disables button while loading", async () => {
    // Delay resolution so we can observe the loading state
    let resolvePromise!: (value: Response) => void;
    const pendingFetch = new Promise<Response>((resolve) => {
      resolvePromise = resolve;
    });
    mockFetch.mockReturnValue(pendingFetch);
    const onSuccess = jest.fn();

    const { StartTimerButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<StartTimerButton onSuccess={onSuccess} />);

    const btn = screen.getByTestId("start-timer-btn");
    fireEvent.click(btn);

    // Button should be disabled while the request is in flight
    expect(btn).toBeDisabled();

    // Cleanup: resolve the pending fetch
    resolvePromise({
      ok: true,
      json: async () => ({ ok: true, data: {} }),
    } as Response);

    await waitFor(() => {
      expect(btn).not.toBeDisabled();
    });
  });

  it("compact mode uses task-timer-btn testid", async () => {
    mockFetch.mockImplementation(makeFetchSuccess());
    const onSuccess = jest.fn();

    const { StartTimerButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<StartTimerButton compact taskId="task-002" onSuccess={onSuccess} />);

    expect(screen.getByTestId("task-timer-btn")).toBeInTheDocument();
    expect(screen.queryByTestId("start-timer-btn")).not.toBeInTheDocument();
  });
});

describe("ApplySuggestionButton", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("applies suggestion, shows success toast, and becomes disabled with 已套用 text", async () => {
    mockFetch.mockImplementation(makeFetchSuccess({ id: "entry-99" }));
    const onSuccess = jest.fn();

    const { ApplySuggestionButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<ApplySuggestionButton suggestion={SUGGESTION} onSuccess={onSuccess} />);

    const btn = screen.getByTestId("apply-suggestion-btn");
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent("套用");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        `已記錄 ${SUGGESTION.estimatedHours}h — ${SUGGESTION.title}`
      );
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);

    // Button should now be disabled and show 已套用
    expect(btn).toBeDisabled();
    expect(btn).toHaveTextContent("已套用");

    // Verify the POST payload
    const callArgs = mockFetch.mock.calls[0];
    expect(callArgs[0]).toBe("/api/time-entries");
    expect(callArgs[1]?.method).toBe("POST");
    const body = JSON.parse(callArgs[1]?.body as string);
    expect(body.taskId).toBe(SUGGESTION.taskId);
    expect(body.hours).toBe(SUGGESTION.estimatedHours);
    expect(body.category).toBe("PLANNED_TASK");
    expect(body.description).toContain(SUGGESTION.title);
  });

  it("shows generic error toast on failure and stays enabled (no raw message leak)", async () => {
    mockFetch.mockImplementation(makeFetchError(400, "Prisma constraint X violated"));
    const onSuccess = jest.fn();

    const { ApplySuggestionButton } = await import(
      "@/app/components/dashboard/quick-log-actions"
    );
    render(<ApplySuggestionButton suggestion={SUGGESTION} onSuccess={onSuccess} />);

    const btn = screen.getByTestId("apply-suggestion-btn");

    await act(async () => {
      fireEvent.click(btn);
    });

    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalled();
    });

    // Issue #1475: use generic fallback, never forward raw server error to users.
    expect(mockToastError).toHaveBeenCalledWith("套用建議失敗，請稍後再試");
    expect(mockToastError).not.toHaveBeenCalledWith(
      expect.stringContaining("Prisma"),
    );

    expect(onSuccess).not.toHaveBeenCalled();

    // Button should remain enabled (not applied) after error
    expect(btn).not.toBeDisabled();
    expect(btn).toHaveTextContent("套用");
  });
});
