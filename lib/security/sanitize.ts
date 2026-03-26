/**
 * XSS Sanitizer — Issue #805 (K-3a)
 *
 * Sanitizes Markdown/HTML content to prevent XSS attacks.
 * Used for task descriptions and comments before rendering.
 *
 * Strategy: strip dangerous tags/attributes while preserving safe Markdown-generated HTML.
 */

/** Tags allowed in rendered Markdown output */
const ALLOWED_TAGS = new Set([
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "br", "hr",
  "strong", "em", "b", "i", "u", "s", "del",
  "ul", "ol", "li",
  "a",
  "code", "pre",
  "blockquote",
  "table", "thead", "tbody", "tr", "th", "td",
  "img",
  "span", "div",
]);

/** Attributes allowed per tag */
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "title", "class"]),
  img: new Set(["src", "alt", "title", "width", "height", "class"]),
  code: new Set(["class"]),
  pre: new Set(["class"]),
  span: new Set(["class", "style"]),
  div: new Set(["class"]),
  th: new Set(["class"]),
  td: new Set(["class"]),
  "*": new Set(["class"]),
};

/** Dangerous URL protocols */
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data):/i;

/**
 * Sanitize a Markdown-rendered HTML string.
 *
 * Removes:
 * - <script>, <style>, <iframe>, <object>, <embed>, <form> tags
 * - Event handler attributes (onclick, onerror, onload, etc.)
 * - javascript: / vbscript: / data: URLs
 * - Inline styles that could execute JS (expression(), url() with js)
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // 1. Remove dangerous tags entirely (including their content)
  // For paired tags: remove opening tag, content, and closing tag
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  result = result.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  result = result.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  result = result.replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, "");
  result = result.replace(/<textarea\b[^>]*>[\s\S]*?<\/textarea>/gi, "");
  result = result.replace(/<select\b[^>]*>[\s\S]*?<\/select>/gi, "");
  result = result.replace(/<button\b[^>]*>[\s\S]*?<\/button>/gi, "");
  // For self-closing/void tags
  result = result.replace(/<(?:iframe|embed|object|input|link|meta|base)\b[^>]*\/?>/gi, "");
  // Remove any remaining closing tags for dangerous elements
  result = result.replace(/<\/(?:script|style|iframe|object|embed|form|input|textarea|select|button|link|meta|base)>/gi, "");

  // 2. Remove event handler attributes (on*)
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");

  // 3. Remove dangerous href/src values
  result = result.replace(
    /(href|src|action)\s*=\s*["']\s*(javascript|vbscript|data):[^"']*["']/gi,
    '$1=""'
  );

  // 4. Remove style attributes with expressions
  result = result.replace(
    /style\s*=\s*["'][^"']*expression\s*\([^"']*["']/gi,
    ""
  );
  result = result.replace(
    /style\s*=\s*["'][^"']*url\s*\(\s*(javascript|vbscript)[^"']*["']/gi,
    ""
  );

  return result;
}

/**
 * Sanitize Markdown source text (before rendering).
 * Strips potentially dangerous raw HTML from Markdown input.
 */
export function sanitizeMarkdown(md: string): string {
  if (!md) return "";

  let result = md;

  // Remove raw HTML script/style/iframe tags from Markdown source
  result = result.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  result = result.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "");
  result = result.replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, "");
  result = result.replace(/<object\b[^>]*>[\s\S]*?<\/object>/gi, "");
  result = result.replace(/<(?:iframe|embed|object)\b[^>]*\/?>/gi, "");
  result = result.replace(/<\/(?:script|style|iframe|object|embed)>/gi, "");

  // Remove event handlers from any HTML tags in Markdown
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");

  // Remove javascript: URLs
  result = result.replace(/javascript\s*:/gi, "");

  return result;
}
