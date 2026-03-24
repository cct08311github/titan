import {
  createDocumentSchema,
  updateDocumentSchema,
} from "../document-validators";

describe("createDocumentSchema", () => {
  const validInput = {
    title: "Architecture Overview",
    content: "## Overview\nThis is the architecture document.",
  };

  test("accepts valid document input", () => {
    const result = createDocumentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test("accepts document with optional parentId", () => {
    const result = createDocumentSchema.safeParse({
      ...validInput,
      parentId: "doc-parent-id-123",
    });
    expect(result.success).toBe(true);
  });

  test("accepts document without content (content defaults to empty)", () => {
    const result = createDocumentSchema.safeParse({ title: "Untitled" });
    expect(result.success).toBe(true);
  });

  test("rejects missing title", () => {
    const result = createDocumentSchema.safeParse({
      content: "Some content",
    });
    expect(result.success).toBe(false);
  });

  test("rejects empty title", () => {
    const result = createDocumentSchema.safeParse({ ...validInput, title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects non-string content", () => {
    const result = createDocumentSchema.safeParse({
      ...validInput,
      content: 12345,
    });
    expect(result.success).toBe(false);
  });
});

describe("updateDocumentSchema", () => {
  test("accepts partial update with only title", () => {
    const result = updateDocumentSchema.safeParse({ title: "New Title" });
    expect(result.success).toBe(true);
  });

  test("accepts partial update with only content", () => {
    const result = updateDocumentSchema.safeParse({ content: "Updated body" });
    expect(result.success).toBe(true);
  });

  test("accepts partial update with parentId", () => {
    const result = updateDocumentSchema.safeParse({ parentId: "new-parent" });
    expect(result.success).toBe(true);
  });

  test("accepts empty object", () => {
    const result = updateDocumentSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  test("rejects empty title in update", () => {
    const result = updateDocumentSchema.safeParse({ title: "" });
    expect(result.success).toBe(false);
  });

  test("rejects non-string content in update", () => {
    const result = updateDocumentSchema.safeParse({ content: true });
    expect(result.success).toBe(false);
  });
});
