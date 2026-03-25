/**
 * Tests for improved error page (Task 24 — Issue #782)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import AppError from "@/app/(app)/error";

// Mock fetch for error-report
global.fetch = jest.fn(() => Promise.resolve({ ok: true } as Response));

// Mock clipboard API
const writeTextMock = jest.fn(() => Promise.resolve());
Object.assign(navigator, {
  clipboard: { writeText: writeTextMock },
});

describe("AppError", () => {
  const mockError = Object.assign(new Error("Test error message"), { digest: "abc123" });
  const mockReset = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders error message", () => {
    render(<AppError error={mockError} reset={mockReset} />);
    expect(screen.getByText("此頁面發生錯誤")).toBeInTheDocument();
  });

  it("renders retry button that calls reset", () => {
    render(<AppError error={mockError} reset={mockReset} />);
    const retryBtn = screen.getByRole("button", { name: /重試/ });
    fireEvent.click(retryBtn);
    expect(mockReset).toHaveBeenCalledTimes(1);
  });

  it("renders report-issue button that copies to clipboard", async () => {
    render(<AppError error={mockError} reset={mockReset} />);
    const reportBtn = screen.getByRole("button", { name: /回報問題/ });
    fireEvent.click(reportBtn);
    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledTimes(1);
    });
    // Copied text should include error message and digest
    const copiedText = writeTextMock.mock.calls[0][0];
    expect(copiedText).toContain("Test error message");
    expect(copiedText).toContain("abc123");
  });

  it("shows confirmation toast after copying", async () => {
    render(<AppError error={mockError} reset={mockReset} />);
    const reportBtn = screen.getByRole("button", { name: /回報問題/ });
    fireEvent.click(reportBtn);
    await waitFor(() => {
      expect(screen.getByText(/已複製/)).toBeInTheDocument();
    });
  });
});
