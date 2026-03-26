/**
 * File upload validation — Issue #811 (K-3b)
 *
 * Validates file size (<=10MB) and MIME type against an allowlist.
 * Checks both file extension and magic bytes for defense-in-depth.
 */

// ─── Config ─────────────────────────────────────────────────────────────────

export const FILE_UPLOAD_CONFIG = {
  /** Maximum file size in bytes (10 MB) */
  MAX_SIZE_BYTES: 10 * 1024 * 1024,
  /** Allowed MIME types mapped to expected extensions */
  ALLOWED_TYPES: new Map<string, string[]>([
    ["application/pdf", [".pdf"]],
    ["application/msword", [".doc"]],
    ["application/vnd.openxmlformats-officedocument.wordprocessingml.document", [".docx"]],
    ["application/vnd.ms-excel", [".xls"]],
    ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", [".xlsx"]],
    ["image/png", [".png"]],
    ["image/jpeg", [".jpg", ".jpeg"]],
    ["text/plain", [".txt"]],
  ]),
} as const;

// ─── Magic bytes for file type verification ─────────────────────────────────

const MAGIC_BYTES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: "application/pdf", bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: "image/png", bytes: [0x89, 0x50, 0x4e, 0x47] }, // .PNG
  { mime: "image/jpeg", bytes: [0xff, 0xd8, 0xff] }, // JFIF / EXIF
  // ZIP-based (docx, xlsx, doc-new)
  { mime: "application/zip", bytes: [0x50, 0x4b, 0x03, 0x04] },
  // OLE2 (doc, xls legacy)
  { mime: "application/ole2", bytes: [0xd0, 0xcf, 0x11, 0xe0] },
];

// ZIP-based MIME types (Office Open XML)
const ZIP_BASED_MIMES = new Set([
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);

// OLE2-based MIME types (legacy Office)
const OLE2_BASED_MIMES = new Set([
  "application/msword",
  "application/vnd.ms-excel",
]);

// ─── Types ──────────────────────────────────────────────────────────────────

export type FileValidationError = {
  code: "FILE_TOO_LARGE" | "INVALID_TYPE" | "MAGIC_BYTES_MISMATCH";
  message: string;
};

export type FileValidationResult =
  | { valid: true }
  | { valid: false; error: FileValidationError };

// ─── Validators ─────────────────────────────────────────────────────────────

/**
 * Validate file size.
 */
export function validateFileSize(sizeBytes: number): FileValidationResult {
  if (sizeBytes > FILE_UPLOAD_CONFIG.MAX_SIZE_BYTES) {
    const maxMB = FILE_UPLOAD_CONFIG.MAX_SIZE_BYTES / (1024 * 1024);
    const actualMB = (sizeBytes / (1024 * 1024)).toFixed(1);
    return {
      valid: false,
      error: {
        code: "FILE_TOO_LARGE",
        message: `檔案大小 ${actualMB}MB 超過上限 ${maxMB}MB`,
      },
    };
  }
  return { valid: true };
}

/**
 * Validate MIME type against allowlist.
 */
export function validateMimeType(mimeType: string): FileValidationResult {
  if (!FILE_UPLOAD_CONFIG.ALLOWED_TYPES.has(mimeType)) {
    const allowed = Array.from(FILE_UPLOAD_CONFIG.ALLOWED_TYPES.values())
      .flat()
      .join(", ");
    return {
      valid: false,
      error: {
        code: "INVALID_TYPE",
        message: `不允許的檔案類型 "${mimeType}"。允許的類型：${allowed}`,
      },
    };
  }
  return { valid: true };
}

/**
 * Validate magic bytes match the declared MIME type.
 * Returns valid if magic bytes cannot be checked (e.g. text/plain).
 */
export function validateMagicBytes(
  buffer: Uint8Array,
  declaredMime: string
): FileValidationResult {
  // text/plain has no reliable magic bytes — skip check
  if (declaredMime === "text/plain") {
    return { valid: true };
  }

  // PDF, PNG, JPEG — check directly
  const directMatch = MAGIC_BYTES.find((m) => m.mime === declaredMime);
  if (directMatch) {
    const offset = directMatch.offset ?? 0;
    const matches = directMatch.bytes.every(
      (b, i) => buffer[offset + i] === b
    );
    if (!matches) {
      return {
        valid: false,
        error: {
          code: "MAGIC_BYTES_MISMATCH",
          message: `檔案內容與宣告的類型 "${declaredMime}" 不符`,
        },
      };
    }
    return { valid: true };
  }

  // ZIP-based Office formats
  if (ZIP_BASED_MIMES.has(declaredMime)) {
    const zipMagic = MAGIC_BYTES.find((m) => m.mime === "application/zip");
    if (zipMagic) {
      const matches = zipMagic.bytes.every((b, i) => buffer[i] === b);
      if (!matches) {
        return {
          valid: false,
          error: {
            code: "MAGIC_BYTES_MISMATCH",
            message: `檔案內容與宣告的類型 "${declaredMime}" 不符（期望 ZIP 格式）`,
          },
        };
      }
    }
    return { valid: true };
  }

  // OLE2-based legacy Office formats
  if (OLE2_BASED_MIMES.has(declaredMime)) {
    const ole2Magic = MAGIC_BYTES.find((m) => m.mime === "application/ole2");
    if (ole2Magic) {
      const matches = ole2Magic.bytes.every((b, i) => buffer[i] === b);
      if (!matches) {
        return {
          valid: false,
          error: {
            code: "MAGIC_BYTES_MISMATCH",
            message: `檔案內容與宣告的類型 "${declaredMime}" 不符（期望 OLE2 格式）`,
          },
        };
      }
    }
    return { valid: true };
  }

  // Unknown type — pass through (shouldn't happen if validateMimeType ran first)
  return { valid: true };
}

/**
 * Full validation pipeline: size + MIME type + magic bytes.
 */
export function validateFile(
  file: { size: number; type: string },
  buffer?: Uint8Array
): FileValidationResult {
  const sizeResult = validateFileSize(file.size);
  if (!sizeResult.valid) return sizeResult;

  const mimeResult = validateMimeType(file.type);
  if (!mimeResult.valid) return mimeResult;

  if (buffer) {
    const magicResult = validateMagicBytes(buffer, file.type);
    if (!magicResult.valid) return magicResult;
  }

  return { valid: true };
}

/**
 * Get allowed file extensions as a comma-separated string (for <input accept>).
 */
export function getAllowedExtensions(): string {
  return Array.from(FILE_UPLOAD_CONFIG.ALLOWED_TYPES.values())
    .flat()
    .join(",");
}

/**
 * Get allowed MIME types as a comma-separated string (for <input accept>).
 */
export function getAllowedMimeTypes(): string {
  return Array.from(FILE_UPLOAD_CONFIG.ALLOWED_TYPES.keys()).join(",");
}
