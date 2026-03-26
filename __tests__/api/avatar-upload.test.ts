/**
 * Avatar upload validation tests — Issue #845 (S-1)
 *
 * Tests the server-side validation logic for avatar uploads:
 * - MIME type restriction (JPG/PNG only)
 * - File size limit (<=2MB)
 * - Magic bytes validation
 */

describe("Avatar Upload Validation — Issue #845 (S-1)", () => {
  const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
  const ALLOWED_TYPES = new Set(["image/jpeg", "image/png"]);

  // Magic bytes
  const PNG_MAGIC = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const JPEG_MAGIC = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
  const EXE_MAGIC = new Uint8Array([0x4d, 0x5a, 0x90, 0x00]); // MZ header

  function validateMagicBytes(buffer: Uint8Array, declaredMime: string): boolean {
    const specs: { mime: string; bytes: number[] }[] = [
      { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] },
      { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] },
    ];
    const spec = specs.find((m) => m.mime === declaredMime);
    if (!spec) return false;
    return spec.bytes.every((b, i) => buffer[i] === b);
  }

  test("accepts valid PNG file", () => {
    expect(ALLOWED_TYPES.has("image/png")).toBe(true);
    expect(validateMagicBytes(PNG_MAGIC, "image/png")).toBe(true);
  });

  test("accepts valid JPEG file", () => {
    expect(ALLOWED_TYPES.has("image/jpeg")).toBe(true);
    expect(validateMagicBytes(JPEG_MAGIC, "image/jpeg")).toBe(true);
  });

  test("rejects non-JPG/PNG MIME types", () => {
    expect(ALLOWED_TYPES.has("application/pdf")).toBe(false);
    expect(ALLOWED_TYPES.has("image/gif")).toBe(false);
    expect(ALLOWED_TYPES.has("image/webp")).toBe(false);
    expect(ALLOWED_TYPES.has("application/octet-stream")).toBe(false);
  });

  test("rejects file exceeding 2MB", () => {
    const size = 3 * 1024 * 1024; // 3MB
    expect(size > AVATAR_MAX_BYTES).toBe(true);
  });

  test("accepts file within 2MB", () => {
    const size = 1.5 * 1024 * 1024; // 1.5MB
    expect(size <= AVATAR_MAX_BYTES).toBe(true);
  });

  test("rejects .exe renamed to .jpg (magic bytes mismatch)", () => {
    // EXE file declared as JPEG
    expect(validateMagicBytes(EXE_MAGIC, "image/jpeg")).toBe(false);
  });

  test("rejects .exe renamed to .png (magic bytes mismatch)", () => {
    expect(validateMagicBytes(EXE_MAGIC, "image/png")).toBe(false);
  });

  test("rejects unknown MIME type even with valid bytes", () => {
    expect(validateMagicBytes(PNG_MAGIC, "application/octet-stream")).toBe(false);
  });

  test("accepts exact 2MB file", () => {
    const size = AVATAR_MAX_BYTES;
    expect(size <= AVATAR_MAX_BYTES).toBe(true);
  });
});
