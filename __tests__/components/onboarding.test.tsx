/**
 * @file onboarding.test.tsx
 * TDD tests for the onboarding new user guide component.
 *
 * Tests:
 * 1. Renders welcome step initially
 * 2. Can navigate forward through all steps
 * 3. Can navigate backward
 * 4. Shows correct step indicators
 * 5. Calls onComplete when finishing
 * 6. Calls onDismiss when skipping
 */

import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { OnboardingGuide } from "@/app/components/onboarding/onboarding-guide";

describe("OnboardingGuide", () => {
  const mockOnComplete = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render the welcome step initially", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );
    expect(screen.getByText(/歡迎/i)).toBeInTheDocument();
  });

  it("should show step indicator", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );
    // Should show step 1 of 4
    expect(screen.getByText(/1/)).toBeInTheDocument();
    expect(screen.getByText(/4/)).toBeInTheDocument();
  });

  it("should navigate to next step when clicking next", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );
    const nextButton = screen.getByRole("button", { name: /下一步|繼續/i });
    fireEvent.click(nextButton);
    // Step 2: profile setup
    expect(screen.getByText("設定個人資料")).toBeInTheDocument();
  });

  it("should navigate back when clicking previous", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );
    // Go to step 2
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));
    expect(screen.getByText("設定個人資料")).toBeInTheDocument();

    // Go back
    const backButton = screen.getByRole("button", { name: /上一步|返回/i });
    fireEvent.click(backButton);
    expect(screen.getByText(/歡迎/i)).toBeInTheDocument();
  });

  it("should not show back button on first step", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );
    expect(
      screen.queryByRole("button", { name: /上一步|返回/i })
    ).not.toBeInTheDocument();
  });

  it("should navigate through all 4 steps", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );

    // Step 1: Welcome
    expect(screen.getByText(/歡迎/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));

    // Step 2: Profile setup
    expect(screen.getByText("設定個人資料")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));

    // Step 3: First timesheet
    expect(screen.getByText(/填寫第一筆工時/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));

    // Step 4: Done
    expect(screen.getByText("準備就緒，開始使用！")).toBeInTheDocument();
  });

  it("should call onComplete when clicking finish on last step", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );

    // Navigate to last step
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));
    fireEvent.click(screen.getByRole("button", { name: /下一步|繼續/i }));

    // Click finish
    const finishButton = screen.getByRole("button", { name: /開始使用|完成/i });
    fireEvent.click(finishButton);

    expect(mockOnComplete).toHaveBeenCalledTimes(1);
  });

  it("should have a skip/dismiss option", () => {
    render(
      <OnboardingGuide onComplete={mockOnComplete} onDismiss={mockOnDismiss} />
    );

    const skipButton = screen.getByRole("button", { name: /跳過|略過/i });
    fireEvent.click(skipButton);

    expect(mockOnDismiss).toHaveBeenCalledTimes(1);
  });
});
