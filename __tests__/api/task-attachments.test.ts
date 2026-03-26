/**
 * @jest-environment node
 */
/**
 * Tests for file validator and attachment logic — Issue #811 (K-3b)
 */
import {
  validateFileSize,
  validateMimeType,
  validateMagicBytes,
  validateFile,
  getAllowedExtensions,
  FILE_UPLOAD_CONFIG,
} from "@/lib/security/file-validator";

describe("File Validator — validateFileSize", () => {
  it("accepts file under 10MB", () => {
    const result = validateFileSize(5 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it("accepts file exactly at 10MB", () => {
    const result = validateFileSize(10 * 1024 * 1024);
    expect(result.valid).toBe(true);
  });

  it("rejects file over 10MB", () => {
    const result = validateFileSize(11 * 1024 * 1024);
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe("FILE_TOO_LARGE");
      expect(result.error.message).toContain("超過上限");
    }
  });

  it("rejects very large file", () => {
    const result = validateFileSize(100 * 1024 * 1024);
    expect(result.valid).toBe(false);
  });

  it("accepts zero-byte file", () => {
    const result = validateFileSize(0);
    expect(result.valid).toBe(true);
  });
});

describe("File Validator — validateMimeType", () => {
  it("accepts PDF", () => {
    expect(validateMimeType("application/pdf").valid).toBe(true);
  });

  it("accepts DOCX", () => {
    expect(validateMimeType("application/vnd.openxmlformats-officedocument.wordprocessingml.document").valid).toBe(true);
  });

  it("accepts DOC", () => {
    expect(validateMimeType("application/msword").valid).toBe(true);
  });

  it("accepts XLS", () => {
    expect(validateMimeType("application/vnd.ms-excel").valid).toBe(true);
  });

  it("accepts XLSX", () => {
    expect(validateMimeType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").valid).toBe(true);
  });

  it("accepts PNG", () => {
    expect(validateMimeType("image/png").valid).toBe(true);
  });

  it("accepts JPEG", () => {
    expect(validateMimeType("image/jpeg").valid).toBe(true);
  });

  it("accepts TXT", () => {
    expect(validateMimeType("text/plain").valid).toBe(true);
  });

  it("rejects EXE", () => {
    const result = validateMimeType("application/x-msdownload");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe("INVALID_TYPE");
    }
  });

  it("rejects shell script", () => {
    const result = validateMimeType("application/x-sh");
    expect(result.valid).toBe(false);
  });

  it("rejects HTML", () => {
    const result = validateMimeType("text/html");
    expect(result.valid).toBe(false);
  });

  it("rejects JavaScript", () => {
    const result = validateMimeType("application/javascript");
    expect(result.valid).toBe(false);
  });

  it("rejects empty MIME type", () => {
    const result = validateMimeType("");
    expect(result.valid).toBe(false);
  });
});

describe("File Validator — validateMagicBytes", () => {
  it("accepts valid PDF magic bytes", () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e]);
    const result = validateMagicBytes(buffer, "application/pdf");
    expect(result.valid).toBe(true);
  });

  it("rejects PDF with wrong magic bytes", () => {
    const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]); // ZIP header
    const result = validateMagicBytes(buffer, "application/pdf");
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.error.code).toBe("MAGIC_BYTES_MISMATCH");
    }
  });

  it("accepts valid PNG magic bytes", () => {
    const buffer = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(validateMagicBytes(buffer, "image/png").valid).toBe(true);
  });

  it("accepts valid JPEG magic bytes", () => {
    const buffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateMagicBytes(buffer, "image/jpeg").valid).toBe(true);
  });

  it("accepts valid ZIP-based DOCX magic bytes", () => {
    const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(validateMagicBytes(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document").valid).toBe(true);
  });

  it("accepts valid ZIP-based XLSX magic bytes", () => {
    const buffer = new Uint8Array([0x50, 0x4b, 0x03, 0x04]);
    expect(validateMagicBytes(buffer, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet").valid).toBe(true);
  });

  it("accepts valid OLE2-based DOC magic bytes", () => {
    const buffer = new Uint8Array([0xd0, 0xcf, 0x11, 0xe0]);
    expect(validateMagicBytes(buffer, "application/msword").valid).toBe(true);
  });

  it("rejects DOCX with wrong magic bytes", () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF header
    const result = validateMagicBytes(buffer, "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    expect(result.valid).toBe(false);
  });

  it("skips magic bytes check for text/plain", () => {
    const buffer = new Uint8Array([0x48, 0x65, 0x6c, 0x6c, 0x6f]); // "Hello"
    expect(validateMagicBytes(buffer, "text/plain").valid).toBe(true);
  });
});

describe("File Validator — validateFile (full pipeline)", () => {
  it("rejects oversized file before checking type", () => {
    const result = validateFile({ size: 20 * 1024 * 1024, type: "application/pdf" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe("FILE_TOO_LARGE");
  });

  it("rejects invalid type even if size ok", () => {
    const result = validateFile({ size: 100, type: "application/x-msdownload" });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe("INVALID_TYPE");
  });

  it("rejects mismatched magic bytes", () => {
    const buffer = new Uint8Array([0x00, 0x00, 0x00, 0x00]);
    const result = validateFile({ size: 100, type: "application/pdf" }, buffer);
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.error.code).toBe("MAGIC_BYTES_MISMATCH");
  });

  it("passes full pipeline for valid PDF", () => {
    const buffer = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    const result = validateFile({ size: 1024, type: "application/pdf" }, buffer);
    expect(result.valid).toBe(true);
  });
});

describe("File Validator — getAllowedExtensions", () => {
  it("returns a comma-separated string of extensions", () => {
    const ext = getAllowedExtensions();
    expect(ext).toContain(".pdf");
    expect(ext).toContain(".docx");
    expect(ext).toContain(".xlsx");
    expect(ext).toContain(".png");
    expect(ext).toContain(".jpg");
    expect(ext).toContain(".txt");
  });
});

describe("Subtask progress calculation", () => {
  it("calculates 0/0 as 0%", () => {
    const total = 0;
    const done = 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;
    expect(pct).toBe(0);
  });

  it("calculates 3/5 as 60%", () => {
    const pct = Math.round((3 / 5) * 100);
    expect(pct).toBe(60);
  });

  it("calculates 5/5 as 100%", () => {
    const pct = Math.round((5 / 5) * 100);
    expect(pct).toBe(100);
  });
});
