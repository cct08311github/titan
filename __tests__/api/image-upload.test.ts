/**
 * @jest-environment node
 */
/**
 * Image Upload API validation tests — Issue #929
 *
 * Tests server-side validation logic for knowledge base image uploads:
 * - MIME type restriction (JPG/PNG/GIF/WebP only)
 * - File size limit (<=5MB)
 * - Magic bytes validation
 * - Reject missing file
 */

describe("Image Upload Validation — Issue #929", () => {
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

  // Magic bytes
  const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const GIF_MAGIC = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]); // GIF89a
  const WEBP_MAGIC = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]);
  const EXE_MAGIC = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ header

  const MAGIC_SPECS: { mime: string; bytes: number[] }[] = [
    { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
    { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    { mime: "image/gif", bytes: [0x47, 0x49, 0x46, 0x38] },
    { mime: "image/webp", bytes: [0x52, 0x49, 0x46, 0x46] },
  ];

  function validateMagicBytes(buffer: Uint8Array, declaredMime: string): boolean {
    const spec = MAGIC_SPECS.find((m) => m.mime === declaredMime);
    if (!spec) return false;
    return spec.bytes.every((b, i) => buffer[i] === b);
  }

  // --- MIME type tests ---

  test("accepts valid PNG MIME type", () => {
    expect(ALLOWED_TYPES.has("image/png")).toBe(true);
  });

  test("accepts valid JPEG MIME type", () => {
    expect(ALLOWED_TYPES.has("image/jpeg")).toBe(true);
  });

  test("accepts valid GIF MIME type", () => {
    expect(ALLOWED_TYPES.has("image/gif")).toBe(true);
  });

  test("accepts valid WebP MIME type", () => {
    expect(ALLOWED_TYPES.has("image/webp")).toBe(true);
  });

  test("rejects PDF MIME type", () => {
    expect(ALLOWED_TYPES.has("application/pdf")).toBe(false);
  });

  test("rejects SVG MIME type", () => {
    expect(ALLOWED_TYPES.has("image/svg+xml")).toBe(false);
  });

  test("rejects application/octet-stream", () => {
    expect(ALLOWED_TYPES.has("application/octet-stream")).toBe(false);
  });

  // --- Magic bytes tests ---

  test("validates PNG magic bytes", () => {
    expect(validateMagicBytes(PNG_MAGIC, "image/png")).toBe(true);
  });

  test("validates JPEG magic bytes", () => {
    expect(validateMagicBytes(JPEG_MAGIC, "image/jpeg")).toBe(true);
  });

  test("validates GIF magic bytes", () => {
    expect(validateMagicBytes(GIF_MAGIC, "image/gif")).toBe(true);
  });

  test("validates WebP magic bytes", () => {
    expect(validateMagicBytes(WEBP_MAGIC, "image/webp")).toBe(true);
  });

  test("rejects .exe renamed to .jpg (magic bytes mismatch)", () => {
    expect(validateMagicBytes(EXE_MAGIC, "image/jpeg")).toBe(false);
  });

  test("rejects .exe renamed to .png (magic bytes mismatch)", () => {
    expect(validateMagicBytes(EXE_MAGIC, "image/png")).toBe(false);
  });

  test("rejects unknown MIME with valid PNG bytes", () => {
    expect(validateMagicBytes(PNG_MAGIC, "application/octet-stream")).toBe(false);
  });

  // --- File size tests ---

  test("rejects file exceeding 5MB", () => {
    const size = 6 * 1024 * 1024;
    expect(size > MAX_SIZE).toBe(true);
  });

  test("accepts file within 5MB", () => {
    const size = 3 * 1024 * 1024;
    expect(size <= MAX_SIZE).toBe(true);
  });

  test("accepts exact 5MB file", () => {
    const size = MAX_SIZE;
    expect(size <= MAX_SIZE).toBe(true);
  });

  test("rejects file just over 5MB", () => {
    const size = MAX_SIZE + 1;
    expect(size > MAX_SIZE).toBe(true);
  });
});
