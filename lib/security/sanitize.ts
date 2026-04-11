/**
 * Escape HTML special characters to prevent XSS when inserting text into HTML context.
 * Use this when you need to embed plain text inside an HTML string (e.g. search snippets).
 */
export function escapeHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * XSS Sanitizer — Issue #805 (K-3a), enhanced Issue #1124, DOMPurify migration Issue #1326
 *
 * Sanitizes Markdown/HTML content to prevent XSS attacks.
 * Uses isomorphic-dompurify (industry standard) instead of hand-rolled regex.
 *
 * Works on both server (jsdom) and client (native DOM).
 */

// Lazy-load isomorphic-dompurify to avoid jsdom initialization at build time.
// Next.js evaluates imports during SSG/prerender — jsdom tries to load browser
// CSS files that don't exist in the build environment.
let _purify: typeof import("isomorphic-dompurify").default | null = null;

function getPurify() {
  if (!_purify) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    _purify = require("isomorphic-dompurify").default;
  }
  return _purify!;
}

/** DOMPurify config matching the existing allowlist behavior */
const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
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
  ],
  ALLOWED_ATTR: [
    "href", "title", "class", "src", "alt", "width", "height",
  ],
  FORBID_ATTR: ["style"],
  // Disallow data:// and other dangerous attributes
  ALLOW_DATA_ATTR: false,
  // Block javascript:, vbscript:, data: — only allow https?, mailto, tel
  ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i,
};

/**
 * Sanitize a Markdown-rendered HTML string.
 *
 * Removes:
 * - <script>, <style>, <iframe>, <object>, <embed>, <form>, and other dangerous tags
 * - Event handler attributes (onclick, onerror, onload, etc.)
 * - javascript: / vbscript: / data: URLs
 * - Any other XSS vectors DOMPurify detects (mutation XSS, parser differentials, encoding tricks)
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return getPurify().sanitize(html, PURIFY_CONFIG) as string;
}

/**
 * Sanitize Markdown source text (before rendering).
 * Strips potentially dangerous raw HTML from Markdown input.
 *
 * In Markdown mode: also strips img (tracking pixel risk) and style attributes.
 */
export function sanitizeMarkdown(md: string): string {
  if (!md) return "";
  return getPurify().sanitize(md, {
    ...PURIFY_CONFIG,
    // In Markdown source mode, strip img tags (tracking pixel risk)
    FORBID_TAGS: ["img"],
    // Strip style attributes (not useful in Markdown source)
    FORBID_ATTR: ["style"],
  }) as string;
}
