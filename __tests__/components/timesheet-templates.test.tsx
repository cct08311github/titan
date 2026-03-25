/**
 * Component tests: TimesheetTemplates UI (TS-30)
 *
 * TDD Red phase — tests written before implementation.
 *
 * Requirements:
 *   - "我的模板" section displays user's templates
 *   - Click template calls onApply with template entries
 *   - "儲存為模板" button calls onSave with name
 *   - Delete button calls onDelete with template id
 *   - Shows empty state when no templates
 */
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { TimesheetTemplates } from "@/app/components/timesheet-templates";

type TemplateEntry = {
  hours: number;
  category: string;
  taskId?: string;
  description?: string;
};

type Template = {
  id: string;
  name: string;
  entries: string; // JSON array
  userId: string;
  createdAt: string;
  updatedAt: string;
};

const MOCK_TEMPLATES: Template[] = [
  {
    id: "tpl-1",
    name: "標準開發日",
    entries: JSON.stringify([
      { hours: 6, category: "PLANNED_TASK", description: "開發" },
      { hours: 1, category: "ADMIN", description: "站會" },
      { hours: 1, category: "LEARNING", description: "技術文件" },
    ]),
    userId: "u1",
    createdAt: "2026-03-20T00:00:00Z",
    updatedAt: "2026-03-20T00:00:00Z",
  },
  {
    id: "tpl-2",
    name: "支援日",
    entries: JSON.stringify([
      { hours: 4, category: "SUPPORT" },
      { hours: 4, category: "PLANNED_TASK" },
    ]),
    userId: "u1",
    createdAt: "2026-03-21T00:00:00Z",
    updatedAt: "2026-03-21T00:00:00Z",
  },
];

describe("TimesheetTemplates (TS-30)", () => {
  const defaultProps = {
    templates: MOCK_TEMPLATES,
    onApply: jest.fn(),
    onDelete: jest.fn(),
    onSave: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders '我的模板' section heading", () => {
    render(<TimesheetTemplates {...defaultProps} />);
    expect(screen.getByText("我的模板")).toBeInTheDocument();
  });

  it("displays template names", () => {
    render(<TimesheetTemplates {...defaultProps} />);
    expect(screen.getByText("標準開發日")).toBeInTheDocument();
    expect(screen.getByText("支援日")).toBeInTheDocument();
  });

  it("calls onApply when template is clicked", () => {
    render(<TimesheetTemplates {...defaultProps} />);
    fireEvent.click(screen.getByText("標準開發日"));
    expect(defaultProps.onApply).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ hours: 6, category: "PLANNED_TASK" }),
      ])
    );
  });

  it("calls onDelete when delete button is clicked", () => {
    render(<TimesheetTemplates {...defaultProps} />);
    const deleteButtons = screen.getAllByLabelText("刪除模板");
    fireEvent.click(deleteButtons[0]);
    expect(defaultProps.onDelete).toHaveBeenCalledWith("tpl-1");
  });

  it("shows empty state when no templates exist", () => {
    render(<TimesheetTemplates {...defaultProps} templates={[]} />);
    expect(screen.getByText(/尚無模板/)).toBeInTheDocument();
  });

  it("shows '儲存為模板' button", () => {
    render(<TimesheetTemplates {...defaultProps} />);
    expect(screen.getByText("儲存為模板")).toBeInTheDocument();
  });

  it("opens save dialog and calls onSave with name", async () => {
    render(<TimesheetTemplates {...defaultProps} />);
    fireEvent.click(screen.getByText("儲存為模板"));

    // Should show name input
    const nameInput = screen.getByPlaceholderText("模板名稱");
    expect(nameInput).toBeInTheDocument();

    fireEvent.change(nameInput, { target: { value: "新模板" } });
    fireEvent.click(screen.getByText("確認儲存"));

    expect(defaultProps.onSave).toHaveBeenCalledWith("新模板");
  });
});
