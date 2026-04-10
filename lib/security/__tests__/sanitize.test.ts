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

  // Regression: single-pass removal left a <script> behind when nested.
  // DOMPurify handles these correctly — the <script> tag and its payload are
  // removed; residual text fragments are left as inert plain text (not
  // executable), which is the correct and safe behavior.
  test("defeats nested-tag script bypass", () => {
    const html = "<scr<script>ipt>alert(1)</script><p>ok</p>";
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<script");
    // DOMPurify removes the <script> tag — the remaining "ipt>alert(1)" text
    // is inert plain text, not executable code. The safe content is preserved.
    expect(result).toContain("<p>ok</p>");
  });

  test("removes orphan opening script tag without close", () => {
    const html = "<p>before</p><script>alert(1)<p>after</p>";
    const result = sanitizeHtml(html);
    expect(result).not.toContain("<script");
    expect(result).toContain("<p>before</p>");
  });

  // Regression: old Pass 8 doubled all backslashes, corrupting legitimate
  // content like file paths and code-block escape sequences.
  test("preserves backslashes in legitimate content", () => {
    const html = "<pre><code>path: C:\\Users\\name\\file.txt</code></pre>";
    const result = sanitizeHtml(html);
    expect(result).toContain("C:\\Users\\name\\file.txt");
    expect(result).not.toContain("\\\\\\\\");
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

  test("removes javascript: protocol in raw HTML anchor", () => {
    // DOMPurify sanitizes HTML — raw HTML inline in Markdown is handled.
    // Markdown link syntax [text](url) is not HTML and is not parsed by
    // DOMPurify; the downstream HTML renderer + sanitizeHtml() blocks that.
    const md = '<a href="javascript:alert(1)">click</a>';
    const result = sanitizeMarkdown(md);
    expect(result).not.toContain("javascript:");
  });

  test("removes event handlers from inline HTML", () => {
    const md = '<img src="x" onerror="alert(1)" />';
    const result = sanitizeMarkdown(md);
    expect(result).not.toContain("onerror");
  });
});
