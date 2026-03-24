/**
 * Page tests: Knowledge Base
 */
import React from "react";
import { render, screen, waitFor, act } from "@testing-library/react";
import "@testing-library/jest-dom";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(() => ({
    data: { user: { id: "u1", name: "Alice", role: "MEMBER" }, expires: "2099" },
    status: "authenticated",
  })),
}));

jest.mock("@/app/components/document-tree", () => ({
  DocumentTree: () => <div data-testid="document-tree" />,
}));
jest.mock("@/app/components/markdown-editor", () => ({
  MarkdownEditor: () => <div data-testid="markdown-editor" />,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const DOCS = [
  { id: "doc-1", parentId: null, title: "Getting Started", slug: "getting-started", version: 1, updatedAt: "2024-01-01" },
];

describe("Knowledge Page", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => DOCS,
    } as Response);
  });

  it("renders without crashing", async () => {
    const { default: KnowledgePage } = await import("@/app/(app)/knowledge/page");
    await act(async () => {
      render(<KnowledgePage />);
    });
    expect(document.body).toBeDefined();
  });

  it("renders document tree component", async () => {
    const { default: KnowledgePage } = await import("@/app/(app)/knowledge/page");
    await act(async () => {
      render(<KnowledgePage />);
    });
    await waitFor(() => {
      expect(screen.getByTestId("document-tree")).toBeInTheDocument();
    });
  });

  it("handles fetch error gracefully", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({}) } as Response);
    const { default: KnowledgePage } = await import("@/app/(app)/knowledge/page");
    await act(async () => {
      render(<KnowledgePage />);
    });
    expect(document.body).toBeDefined();
  });

  it("shows empty state guidance when document list is empty", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => [] } as Response);
    const { default: KnowledgePage } = await import("@/app/(app)/knowledge/page");
    await act(async () => {
      render(<KnowledgePage />);
    });
    await waitFor(() => {
      // 無文件時應顯示引導訊息
      expect(screen.getByText("尚無文件")).toBeInTheDocument();
      expect(screen.getByText("點擊 + 新增文件")).toBeInTheDocument();
    });
    // 空資料時不應渲染 DocumentTree
    expect(screen.queryByTestId("document-tree")).not.toBeInTheDocument();
  });

  it("renders without crash when document list has partial fields", async () => {
    // Partial schema: docs missing optional fields
    const partial = [
      { id: "d1", parentId: null, title: "Doc A" /* slug / version / updatedAt missing */ },
    ];
    mockFetch.mockResolvedValue({ ok: true, json: async () => partial } as Response);
    const { default: KnowledgePage } = await import("@/app/(app)/knowledge/page");
    await act(async () => {
      render(<KnowledgePage />);
    });
    expect(document.body).toBeDefined();
  });
});
