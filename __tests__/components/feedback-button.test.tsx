/**
 * Tests for FeedbackButton (Task 26 — Issue #787)
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { FeedbackButton } from "@/app/components/feedback-button";

// Mock fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe("FeedbackButton", () => {
  beforeEach(() => {
    mockFetch.mockReset();
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
  });

  it("renders the floating button", () => {
    render(<FeedbackButton />);
    expect(screen.getByLabelText("意見回饋")).toBeInTheDocument();
  });

  it("opens modal when clicked", () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByLabelText("意見回饋"));
    expect(screen.getByText("意見回饋")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/請描述/)).toBeInTheDocument();
  });

  it("disables submit when textarea is empty", () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByLabelText("意見回饋"));
    const submitBtn = screen.getByRole("button", { name: /送出/ });
    expect(submitBtn).toBeDisabled();
  });

  it("submits feedback and shows toast", async () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByLabelText("意見回饋"));
    const textarea = screen.getByPlaceholderText(/請描述/);
    fireEvent.change(textarea, { target: { value: "Great feature!" } });
    const submitBtn = screen.getByRole("button", { name: /送出/ });
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/feedback", expect.objectContaining({
        method: "POST",
      }));
    });
    // Toast appears
    await waitFor(() => {
      expect(screen.getByText(/感謝/)).toBeInTheDocument();
    });
  });

  it("closes modal with X button", () => {
    render(<FeedbackButton />);
    fireEvent.click(screen.getByLabelText("意見回饋"));
    expect(screen.getByText("意見回饋")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("關閉"));
    expect(screen.queryByPlaceholderText(/請描述/)).not.toBeInTheDocument();
  });
});
