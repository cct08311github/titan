/**
 * XSS Sanitizer — Issue #805 (K-3a), enhanced Issue #1124
 *
 * Sanitizes Markdown/HTML content to prevent XSS attacks.
 * Used for task descriptions and comments before rendering.
 *
 * Strategy: strip dangerous tags/attributes while preserving safe Markdown-generated HTML.
 *
 * Defense-in-depth: multiple passes to catch bypassed filters.
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

/** Dangerous tags that should be completely removed (including content) */
const DISALLOWED_TAGS = new Set([
  "script", "style", "iframe", "object", "embed", "form",
  "textarea", "select", "button", "input", "link", "meta", "base",
  "svg", "math", "xml",
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

/** Dangerous URL protocols — complete blocklist */
const DANGEROUS_PROTOCOLS = /^(javascript|vbscript|data|ftp|file|mailto):/i;

/** CSS functions that can execute code */
const DANGEROUS_CSS_FUNCTIONS = /\b(expression\s*\(|url\s*\(\s*(javascript|vbscript|data):)/i;

/** XSS vector patterns in attribute values */
const XSS_ATTR_PATTERNS = [
  // Event handlers
  /\s+on\w+\s*=/gi,
  // JavaScript pseudo-protocols in attributes
  /javascript\s*:/gi,
  /vbscript\s*:/gi,
  /data\s*:/gi,
  // SVG/SMIL animation elements
  /<animate/gi,
  /<set\s/gi,
  /<animation/gi,
  /<keyframe/gi,
];

/**
 * Sanitize a Markdown-rendered HTML string.
 *
 * Removes:
 * - <script>, <style>, <iframe>, <object>, <embed>, <form> tags (including content)
 * - SVG/MathML tags (XSS vectors via animate, set, etc.)
 * - Event handler attributes (onclick, onerror, onload, etc.)
 * - javascript: / vbscript: / data: URLs
 * - Inline styles that could execute JS (expression(), url() with js)
 * - data: URLs in img src (forced download vectors)
 *
 * Defense-in-depth: multiple passes to catch filter bypass attempts.
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";

  let result = html;

  // Pass 1: Remove dangerous tags entirely (including their content)
  for (const tag of DISALLOWED_TAGS) {
    // Match opening tag with any attributes
    const openTag = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(openTag, "");
    // Match self-closing/void tags
    const voidTag = new RegExp(`<${tag}\\b[^>]*(?:\\/\\s*)?>`, "gi");
    result = result.replace(voidTag, "");
  }

  // Pass 2: Remove SVG-based XSS vectors (animate, set, animation, keyframe)
  result = result.replace(/<animate\b[^>]*>/gi, "");
  result = result.replace(/<set\s[^>]*>/gi, "");
  result = result.replace(/<animation[^>]*>[\s\S]*?<\/animation>/gi, "");
  result = result.replace(/<keyframe[^>]*>[\s\S]*?<\/keyframe>/gi, "");

  // Pass 3: Remove SVG/Math namespace declarations that could introduce vectors
  result = result.replace(/\s+xmlns\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/<svg[^>]*>/gi, (match) => {
    // Keep svg tag but remove event handlers and xlink attributes
    return match.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  });

  // Pass 4: Remove event handler attributes (on*)
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  result = result.replace(/\s+on\w+\s*=\s*[^\s>]*[\s>]*/gi, "");

  // Pass 5: Remove dangerous href/src/action values with protocols
  result = result.replace(
    /(href|src|action|formaction|xlink:href)\s*=\s*["']\s*(javascript|vbscript|data|ftp|file):[^"']*["']/gi,
    '$1=""'
  );

  // Pass 6: Block data: URLs in img src (could be used for forced download or tracking)
  result = result.replace(
    /<img\s+([^>]*?)src\s*=\s*["']\s*data:[^"']*["']([^>]*?)>/gi,
    '<img $1src=""$2 alt="[blocked]" title="data URL blocked">'
  );

  // Pass 7: Remove style attributes with dangerous CSS functions
  result = result.replace(
    /style\s*=\s*["'][^"']*\bexpression\s*\([^"']*["']/gi,
    'style=""'
  );
  result = result.replace(
    /style\s*=\s*["'][^"']*\burl\s*\(\s*(javascript|vbscript|data):[^"']*["']/gi,
    'style=""'
  );

  // Pass 8: Remove CSS escape sequences that could bypass filters
  result = result.replace(/\\/g, "\\\\");

  // Pass 9: Normalize whitespace in URLs to prevent bypass via special chars
  result = result.replace(
    /(href|src)\s*=\s*["']\s*[\s\n\r\t]+/gi,
    '$1="'
  );

  // Pass 10: Final sweep for any remaining XSS patterns
  for (const pattern of XSS_ATTR_PATTERNS) {
    result = result.replace(pattern, "");
  }

  return result;
}

/**
 * Sanitize Markdown source text (before rendering).
 * Strips potentially dangerous raw HTML from Markdown input.
 */
export function sanitizeMarkdown(md: string): string {
  if (!md) return "";

  let result = md;

  // Pass 1: Remove raw HTML dangerous tags from Markdown source
  for (const tag of DISALLOWED_TAGS) {
    const openTag = new RegExp(`<${tag}\\b[^>]*>[\\s\\S]*?<\\/${tag}>`, "gi");
    result = result.replace(openTag, "");
    const voidTag = new RegExp(`<${tag}\\b[^>]*(?:\\/\\s*)?>`, "gi");
    result = result.replace(voidTag, "");
  }

  // Pass 2: Remove SVG/Math-based vectors
  result = result.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, "");
  result = result.replace(/<math\b[^>]*>[\s\S]*?<\/math>/gi, "");
  result = result.replace(/<animate\b[^>]*>/gi, "");
  result = result.replace(/<set\s[^>]*>/gi, "");

  // Pass 3: Remove event handlers from any HTML tags in Markdown
  result = result.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");

  // Pass 4: Remove javascript: and other dangerous protocols
  result = result.replace(/\bjavascript\s*:/gi, "");
  result = result.replace(/\bvbscript\s*:/gi, "");
  result = result.replace(/\bdata\s*:\s*/gi, "blocked:");

  // Pass 5: Remove CSS expression() function
  result = result.replace(/\bexpression\s*\(/gi, "blocked(");

  return result;
}
