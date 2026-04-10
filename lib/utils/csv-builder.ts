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
 * Characters that Excel/LibreOffice/Numbers interpret as formula prefix
 * when found at the start of a cell. An attacker who controls a CSV cell
 * can inject formulas like =cmd|'/c calc'!A1 or =HYPERLINK("evil.com").
 *
 * Mitigation: prefix the cell with a single tab, which Excel renders as
 * empty and a sane importer ignores. Per OWASP CSV-Injection prevention.
 */
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

/**
 * Escape a CSV field value according to RFC 4180 plus CSV-injection
 * prevention (OWASP).
 *
 * - Prefixes formula triggers (= + - @) with a tab to neutralize.
 * - Quotes fields containing commas, double-quotes, or newlines.
 */
export function escapeCsvField(value: unknown): string {
  let str = value == null ? "" : String(value);

  // CSV-injection defense: neutralize formula prefix at start of cell.
  if (str.length > 0 && FORMULA_PREFIXES.includes(str[0])) {
    str = "\t" + str;
  }

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
