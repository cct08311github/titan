/**
 * Component tests: Topbar
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";

// Mock next-auth/react
jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: {
      user: { id: "user-1", name: "Alice", email: "a@example.com", role: "MEMBER" },
    },
    status: "authenticated",
  })),
  signOut: jest.fn(),
}));

// Mock NotificationBell
jest.mock("@/app/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));

import { Topbar } from "@/app/components/topbar";
import { useSession, signOut } from "next-auth/react";

const mockUseSession = useSession as jest.MockedFunction<typeof useSession>;
const mockSignOut = signOut as jest.MockedFunction<typeof signOut>;

describe("Topbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "user-1", name: "Alice", email: "a@example.com", role: "MEMBER" },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: jest.fn(),
    });
  });

  it("renders user name from session", () => {
    render(<Topbar />);
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders MEMBER role label as 工程師", () => {
    render(<Topbar />);
    expect(screen.getByText("工程師")).toBeInTheDocument();
  });

  it("renders MANAGER role label as 主管", () => {
    mockUseSession.mockReturnValue({
      data: {
        user: { id: "mgr-1", name: "Boss", email: "boss@example.com", role: "MANAGER" },
        expires: "2099-01-01",
      },
      status: "authenticated",
      update: jest.fn(),
    });
    render(<Topbar />);
    expect(screen.getByText("主管")).toBeInTheDocument();
  });

  it("renders notification bell", () => {
    render(<Topbar />);
    expect(screen.getByTestId("notification-bell")).toBeInTheDocument();
  });

  it("renders logout button", () => {
    render(<Topbar />);
    expect(screen.getByLabelText("登出")).toBeInTheDocument();
  });

  it("calls signOut when logout button clicked", () => {
    render(<Topbar />);
    fireEvent.click(screen.getByLabelText("登出"));
    expect(mockSignOut).toHaveBeenCalledWith({ callbackUrl: "/login" });
  });

  it("shows default username when no session", () => {
    mockUseSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: jest.fn(),
    });
    render(<Topbar />);
    expect(screen.getByText("使用者")).toBeInTheDocument();
  });
});
