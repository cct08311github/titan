import { sanitizeHtml, sanitizeMarkdown } from "../sanitize";

describe("sanitizeHtml", () => {
  test("returns empty string for empty input", () => {
    expect(sanitizeHtml("")).toBe("");
  });

  test("preserves safe HTML", () => {
    const html = '<p>Hello <strong>world</strong></p>';
    expect(sanitizeHtml(html)).toBe(html);
  });

  test("removes script tags", () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>world</p>';
    expect(sanitizeHtml(html)).toBe("<p>Hello</p><p>world</p>");
  });

  test("removes style tags", () => {
    const html = '<style>body{display:none}</style><p>text</p>';
    expect(sanitizeHtml(html)).toBe("<p>text</p>");
  });

  test("removes iframe tags", () => {
    const html = '<iframe src="evil.com"></iframe><p>safe</p>';
    expect(sanitizeHtml(html)).toBe("<p>safe</p>");
  });

  test("removes event handlers", () => {
    const html = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("onerror");
  });

  test("removes javascript: URLs", () => {
    const html = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("javascript:");
  });

  test("removes onclick handlers", () => {
    const html = '<div onclick="alert(1)">text</div>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("onclick");
  });

  test("removes form elements", () => {
    const html = '<form><input type="text" /><button>submit</button></form>';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<form");
    expect(result).not.toContain("<input");
    expect(result).not.toContain("<button");
  });

  test("removes embed and object tags", () => {
    const html = '<object data="evil.swf"></object><embed src="evil.swf" />';
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<object");
    expect(result).not.toContain("<embed");
  });
});

describe("sanitizeMarkdown", () => {
  test("returns empty string for empty input", () => {
    expect(sanitizeMarkdown("")).toBe("");
  });

  test("preserves normal markdown", () => {
    const md = "# Hello\n\n**bold** and *italic*";
    expect(sanitizeMarkdown(md)).toBe(md);
  });

  test("removes script tags from markdown source", () => {
    const md = 'Hello <script>alert(1)</script> world';
    const result = sanitizeMarkdown(md);
    expect(result).not.toContain("<script");
    expect(result).toContain("Hello");
    expect(result).toContain("world");
  });

  test("removes javascript: protocol", () => {
    const md = '[click me](javascript:alert(1))';
    const result = sanitizeMarkdown(md);
    expect(result).not.toContain("javascript:");
  });

  test("removes event handlers from inline HTML", () => {
    const md = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeMarkdown(md);
    expect(result).not.toContain("onerror");
  });
});
