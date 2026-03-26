/**
 * CSV Builder — R-3 (#838)
 *
 * RFC 4180 compliant CSV generation with:
 * - UTF-8 BOM for Excel CJK compatibility
 * - Proper quoting for commas, quotes, newlines
 * - Streaming support for large datasets
 * - Configurable filename format: {type}_{dateRange}_{exportDate}.csv
 */

export interface CsvColumn {
  header: string;
  key: string;
}

/**
 * Escape a CSV field value according to RFC 4180.
 * Quotes fields containing commas, double-quotes, or newlines.
 */
export function escapeCsvField(value: unknown): string {
  const str = value == null ? "" : String(value);
  if (str.includes(",") || str.includes('"') || str.includes("\n") || str.includes("\r")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Generate a RFC 4180 CSV string from rows and column definitions.
 */
export function generateCsvString(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  const headerLine = columns.map((c) => escapeCsvField(c.header)).join(",");
  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCsvField(row[c.key])).join(","),
  );
  return [headerLine, ...dataLines].join("\r\n");
}

/** UTF-8 BOM prefix for Excel compatibility with CJK text */
export const UTF8_BOM = "\uFEFF";

/**
 * Generate a complete CSV string with UTF-8 BOM.
 */
export function buildCsvWithBom(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
): string {
  return UTF8_BOM + generateCsvString(rows, columns);
}

/**
 * Generate a standardized export filename.
 * Format: {reportType}_{dateFrom}-{dateTo}_{exportDate}.csv
 */
export function buildExportFilename(
  reportType: string,
  dateFrom?: string,
  dateTo?: string,
): string {
  const exportDate = new Date().toISOString().slice(0, 10);
  const rangePart = dateFrom && dateTo ? `_${dateFrom}_${dateTo}` : "";
  return `${reportType}${rangePart}_${exportDate}.csv`;
}

/**
 * Create a streaming CSV generator for large datasets.
 * Yields chunks: BOM + header, then batches of data rows.
 */
export function* streamCsvRows(
  rows: Record<string, unknown>[],
  columns: CsvColumn[],
  batchSize = 500,
): Generator<string> {
  // First chunk: BOM + header
  const header = UTF8_BOM + columns.map((c) => escapeCsvField(c.header)).join(",") + "\r\n";
  yield header;

  // Data chunks
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize);
    const chunk = batch
      .map((row) => columns.map((c) => escapeCsvField(row[c.key])).join(","))
      .join("\r\n");
    yield chunk + "\r\n";
  }
}
