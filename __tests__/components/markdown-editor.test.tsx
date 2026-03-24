/**
 * Component tests: MarkdownEditor
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import { MarkdownEditor } from "@/app/components/markdown-editor";

describe("MarkdownEditor", () => {
  const defaultProps = {
    value: "# Hello World",
    onChange: jest.fn(),
    placeholder: "Write here...",
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("renders edit and preview mode buttons", () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(screen.getByText("編輯")).toBeInTheDocument();
    expect(screen.getByText("預覽")).toBeInTheDocument();
  });

  it("defaults to edit mode showing textarea", () => {
    render(<MarkdownEditor {...defaultProps} />);
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows textarea with current value in edit mode", () => {
    render(<MarkdownEditor {...defaultProps} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveValue("# Hello World");
  });

  it("calls onChange when textarea content changes", () => {
    const onChange = jest.fn();
    render(<MarkdownEditor value="" onChange={onChange} />);
    const textarea = screen.getByRole("textbox");
    fireEvent.change(textarea, { target: { value: "New content" } });
    expect(onChange).toHaveBeenCalledWith("New content");
  });

  it("switches to preview mode when preview button clicked", () => {
    render(<MarkdownEditor {...defaultProps} />);
    fireEvent.click(screen.getByText("預覽"));
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("renders preview mode without textarea", () => {
    render(<MarkdownEditor value="# Title" onChange={jest.fn()} />);
    fireEvent.click(screen.getByText("預覽"));
    // In preview mode, textarea is not rendered
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
  });

  it("switches back to edit mode when edit button clicked", () => {
    render(<MarkdownEditor {...defaultProps} />);
    fireEvent.click(screen.getByText("預覽"));
    fireEvent.click(screen.getByText("編輯"));
    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("shows placeholder when value is empty", () => {
    render(<MarkdownEditor value="" onChange={jest.fn()} placeholder="Write here..." />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveAttribute("placeholder", "Write here...");
  });

  it("applies minHeight style to editor", () => {
    render(<MarkdownEditor value="" onChange={jest.fn()} minHeight={300} />);
    const textarea = screen.getByRole("textbox");
    expect(textarea).toHaveStyle({ minHeight: "300px" });
  });

  it("highlights edit button as active in edit mode", () => {
    render(<MarkdownEditor {...defaultProps} />);
    const editBtn = screen.getByText("編輯").closest("button");
    expect(editBtn?.className).toContain("bg-accent");
  });

  it("highlights preview button as active in preview mode", () => {
    render(<MarkdownEditor {...defaultProps} />);
    fireEvent.click(screen.getByText("預覽"));
    const previewBtn = screen.getByText("預覽").closest("button");
    expect(previewBtn?.className).toContain("bg-accent");
  });
});
