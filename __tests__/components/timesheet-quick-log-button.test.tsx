/**
 * Component tests: QuickLogButton (Issue #1539-2)
 *
 * Covers:
 * - Trigger button renders with correct label
 * - Modal opens on click and closes on Esc / backdrop / cancel
 * - Form defaults: today's date, hours=1, category=PLANNED_TASK
 * - Validation: rejects 0 / negative / > 24 hours
 * - Save calls onSave with correct args, then closes modal
 * - localStorage persists last-used category
 */
import React from "react";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";
import { QuickLogButton } from "@/app/components/timesheet/quick-log-button";

jest.mock("lucide-react", () => ({
  Plus: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-plus" {...props} />,
  X: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-x" {...props} />,
  Loader2: (props: React.SVGProps<SVGSVGElement>) => <svg data-testid="icon-loader" {...props} />,
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const TASKS = [
  { id: "task-1", title: "Refactor api layer" },
  { id: "task-2", title: "Add reaction digest" },
];

function renderButton(onSave = jest.fn().mockResolvedValue(undefined)) {
  render(<QuickLogButton tasks={TASKS} onSave={onSave} />);
  return { onSave };
}

describe("QuickLogButton", () => {
  beforeEach(() => {
    window.localStorage.clear();
    jest.clearAllMocks();
  });

  it("renders trigger button with correct label", () => {
    renderButton();
    expect(screen.getByTestId("quick-log-trigger")).toHaveTextContent("快速記時數");
  });

  it("opens modal when trigger clicked, closes on backdrop click", async () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    expect(screen.getByTestId("quick-log-modal")).toBeInTheDocument();

    // backdrop click — click the dialog container (target === currentTarget)
    fireEvent.click(screen.getByTestId("quick-log-modal"));
    expect(screen.queryByTestId("quick-log-modal")).not.toBeInTheDocument();
  });

  it("closes on Esc key", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    expect(screen.getByTestId("quick-log-modal")).toBeInTheDocument();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("quick-log-modal")).not.toBeInTheDocument();
  });

  it("closes when cancel button clicked", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    fireEvent.click(screen.getByTestId("quick-log-cancel"));
    expect(screen.queryByTestId("quick-log-modal")).not.toBeInTheDocument();
  });

  it("uses today's date as default", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    const dateInput = screen.getByTestId("quick-log-date") as HTMLInputElement;
    const today = new Date();
    const expected = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    expect(dateInput.value).toBe(expected);
  });

  it("defaults to 1 hour and PLANNED_TASK category", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    expect((screen.getByTestId("quick-log-hours") as HTMLInputElement).value).toBe("1");
    expect((screen.getByTestId("quick-log-category") as HTMLSelectElement).value).toBe("PLANNED_TASK");
  });

  it("rejects zero hours", async () => {
    const { onSave } = renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    fireEvent.change(screen.getByTestId("quick-log-hours"), { target: { value: "0" } });
    fireEvent.click(screen.getByTestId("quick-log-save"));
    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it("rejects hours > 24", async () => {
    const { onSave } = renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    fireEvent.change(screen.getByTestId("quick-log-hours"), { target: { value: "25" } });
    fireEvent.click(screen.getByTestId("quick-log-save"));
    await waitFor(() => {
      expect(onSave).not.toHaveBeenCalled();
    });
  });

  it("saves with correct args and closes modal", async () => {
    const { onSave } = renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));

    fireEvent.change(screen.getByTestId("quick-log-hours"), { target: { value: "2.5" } });
    fireEvent.change(screen.getByTestId("quick-log-task"), { target: { value: "task-1" } });
    fireEvent.change(screen.getByTestId("quick-log-category"), { target: { value: "INCIDENT" } });
    fireEvent.change(screen.getByTestId("quick-log-description"), { target: { value: "客戶緊急請求" } });

    fireEvent.click(screen.getByTestId("quick-log-save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        "task-1",
        expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        2.5,
        "INCIDENT",
        "客戶緊急請求",
        "NONE",
      );
    });

    await waitFor(() => {
      expect(screen.queryByTestId("quick-log-modal")).not.toBeInTheDocument();
    });
  });

  it("passes null taskId when free entry chosen", async () => {
    const { onSave } = renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    // Default value is "" (free entry), so don't change task
    fireEvent.click(screen.getByTestId("quick-log-save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        null,
        expect.any(String),
        1,
        "PLANNED_TASK",
        "",
        "NONE",
      );
    });
  });

  it("persists last-used category to localStorage", async () => {
    const { onSave } = renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    fireEvent.change(screen.getByTestId("quick-log-category"), { target: { value: "LEARNING" } });
    fireEvent.click(screen.getByTestId("quick-log-save"));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalled();
    });
    expect(window.localStorage.getItem("titan:quickLog:lastCategory")).toBe("LEARNING");
  });

  it("restores last-used category on mount", () => {
    window.localStorage.setItem("titan:quickLog:lastCategory", "ADMIN");
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    expect((screen.getByTestId("quick-log-category") as HTMLSelectElement).value).toBe("ADMIN");
  });

  it("ignores invalid stored category", () => {
    window.localStorage.setItem("titan:quickLog:lastCategory", "BOGUS");
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    expect((screen.getByTestId("quick-log-category") as HTMLSelectElement).value).toBe("PLANNED_TASK");
  });

  it("Cmd+Enter saves form", async () => {
    const { onSave } = renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    fireEvent.change(screen.getByTestId("quick-log-hours"), { target: { value: "3" } });

    // Find the modal inner container (where onKeyDown is bound)
    const hoursInput = screen.getByTestId("quick-log-hours");
    fireEvent.keyDown(hoursInput, { key: "Enter", metaKey: true });

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith(
        null,
        expect.any(String),
        3,
        "PLANNED_TASK",
        "",
        "NONE",
      );
    });
  });

  it("renders all 6 category options", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    const select = screen.getByTestId("quick-log-category") as HTMLSelectElement;
    expect(select.options).toHaveLength(6);
  });

  it("renders task options including free-entry", () => {
    renderButton();
    fireEvent.click(screen.getByTestId("quick-log-trigger"));
    const select = screen.getByTestId("quick-log-task") as HTMLSelectElement;
    expect(select.options).toHaveLength(3); // 1 free + 2 tasks
    expect(select.options[0].text).toBe("自由工時（無任務）");
  });

  // Issue #1539-8: controlled mode (external trigger via prop)
  describe("controlled mode (Issue #1539-8)", () => {
    it("opens modal when controlled open prop is true", () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onOpenChange = jest.fn();
      const { rerender } = render(
        <QuickLogButton tasks={TASKS} onSave={onSave} open={false} onOpenChange={onOpenChange} />
      );
      expect(screen.queryByTestId("quick-log-modal")).not.toBeInTheDocument();

      rerender(
        <QuickLogButton tasks={TASKS} onSave={onSave} open={true} onOpenChange={onOpenChange} />
      );
      expect(screen.getByTestId("quick-log-modal")).toBeInTheDocument();
    });

    it("calls onOpenChange when trigger button clicked in controlled mode", () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onOpenChange = jest.fn();
      render(
        <QuickLogButton tasks={TASKS} onSave={onSave} open={false} onOpenChange={onOpenChange} />
      );
      fireEvent.click(screen.getByTestId("quick-log-trigger"));
      expect(onOpenChange).toHaveBeenCalledWith(true);
    });

    it("calls onOpenChange when modal closed via cancel in controlled mode", () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      const onOpenChange = jest.fn();
      render(
        <QuickLogButton tasks={TASKS} onSave={onSave} open={true} onOpenChange={onOpenChange} />
      );
      fireEvent.click(screen.getByTestId("quick-log-cancel"));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });

    it("falls back to internal state when uncontrolled", () => {
      const onSave = jest.fn().mockResolvedValue(undefined);
      render(<QuickLogButton tasks={TASKS} onSave={onSave} />);
      expect(screen.queryByTestId("quick-log-modal")).not.toBeInTheDocument();
      fireEvent.click(screen.getByTestId("quick-log-trigger"));
      expect(screen.getByTestId("quick-log-modal")).toBeInTheDocument();
    });
  });
});
