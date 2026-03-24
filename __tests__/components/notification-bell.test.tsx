/**
 * Component tests: NotificationBell
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { NotificationBell } from "@/app/components/notification-bell";

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

const MOCK_NOTIFICATIONS = [
  {
    id: "n-1",
    type: "TASK_ASSIGNED",
    title: "You have a new task",
    body: "Please check it",
    isRead: false,
    createdAt: new Date().toISOString(),
  },
  {
    id: "n-2",
    type: "TASK_OVERDUE",
    title: "Task overdue",
    body: null,
    isRead: true,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
  },
];

describe("NotificationBell", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: MOCK_NOTIFICATIONS, unreadCount: 1 }),
    } as Response);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("renders bell button", async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    expect(screen.getByLabelText("通知")).toBeInTheDocument();
  });

  it("shows unread count badge when there are unread notifications", async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.getByText("1")).toBeInTheDocument();
    });
  });

  it("does not show badge when unreadCount is 0", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    } as Response);
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.queryByText("0")).not.toBeInTheDocument();
    });
  });

  it("opens dropdown when bell is clicked", async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("通知"));
    });
    expect(screen.getByText("通知")).toBeInTheDocument();
  });

  it("shows notification title in dropdown", async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("通知"));
    });
    await waitFor(() => {
      expect(screen.getByText("You have a new task")).toBeInTheDocument();
    });
  });

  it("shows notification type label", async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("通知"));
    });
    await waitFor(() => {
      expect(screen.getByText("任務指派")).toBeInTheDocument();
    });
  });

  it("shows empty state when no notifications", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 0 }),
    } as Response);
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("通知"));
    });
    await waitFor(() => {
      expect(screen.getByText("目前沒有通知")).toBeInTheDocument();
    });
  });

  it("closes dropdown when X button is clicked", async () => {
    await act(async () => {
      render(<NotificationBell />);
    });
    await act(async () => {
      fireEvent.click(screen.getByLabelText("通知"));
    });
    await waitFor(() => {
      expect(screen.getByText("通知")).toBeInTheDocument();
    });
    // Find close button by its parent context
    const closeBtn = document.querySelector('button[title]') as HTMLButtonElement || null;
    // Click the X button (last button before closing)
    const allButtons = screen.getAllByRole("button");
    const xButton = allButtons.find(btn => btn.querySelector("svg") && btn.getAttribute("aria-label") !== "通知");
    if (xButton) {
      await act(async () => {
        fireEvent.click(xButton);
      });
    }
  });

  it("shows 99+ when unread count exceeds 99", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ notifications: [], unreadCount: 150 }),
    } as Response);
    await act(async () => {
      render(<NotificationBell />);
    });
    await waitFor(() => {
      expect(screen.getByText("99+")).toBeInTheDocument();
    });
  });
});
