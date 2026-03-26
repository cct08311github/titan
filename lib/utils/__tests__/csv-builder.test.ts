/**
 * Tests for CSV builder — R-3 (#838)
 */
import {
  escapeCsvField,
  generateCsvString,
  buildCsvWithBom,
  buildExportFilename,
  streamCsvRows,
  UTF8_BOM,
} from "../csv-builder";

describe("escapeCsvField", () => {
  it("returns plain string as-is", () => {
    expect(escapeCsvField("hello")).toBe("hello");
  });

  it("quotes fields containing commas", () => {
    expect(escapeCsvField("a,b")).toBe('"a,b"');
  });

  it("quotes fields containing double quotes and escapes them", () => {
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
  });

  it("quotes fields containing newlines", () => {
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
  });

  it("handles null and undefined as empty string", () => {
    expect(escapeCsvField(null)).toBe("");
    expect(escapeCsvField(undefined)).toBe("");
  });

  it("converts numbers to string", () => {
    expect(escapeCsvField(42)).toBe("42");
    expect(escapeCsvField(3.14)).toBe("3.14");
  });
});

describe("generateCsvString", () => {
  const columns = [
    { header: "Name", key: "name" },
    { header: "Value", key: "value" },
  ];

  it("generates header row", () => {
    const csv = generateCsvString([], columns);
    expect(csv).toBe("Name,Value");
  });

  it("generates header + data rows", () => {
    const rows = [
      { name: "Alice", value: 10 },
      { name: "Bob", value: 20 },
    ];
    const csv = generateCsvString(rows, columns);
    expect(csv).toBe("Name,Value\r\nAlice,10\r\nBob,20");
  });

  it("handles missing keys as empty", () => {
    const rows = [{ name: "Alice" }];
    const csv = generateCsvString(rows, columns);
    expect(csv).toBe("Name,Value\r\nAlice,");
  });

  it("escapes special chars in data", () => {
    const rows = [{ name: "O'Brien, Jr.", value: 'say "hi"' }];
    const csv = generateCsvString(rows, columns);
    expect(csv).toContain('"O\'Brien, Jr."');
    expect(csv).toContain('"say ""hi"""');
  });
});

describe("buildCsvWithBom", () => {
  it("prepends UTF-8 BOM", () => {
    const csv = buildCsvWithBom([], [{ header: "A", key: "a" }]);
    expect(csv.charCodeAt(0)).toBe(0xFEFF);
    expect(csv.startsWith(UTF8_BOM)).toBe(true);
  });

  it("contains correct CSV content after BOM", () => {
    const csv = buildCsvWithBom(
      [{ a: "1" }],
      [{ header: "A", key: "a" }],
    );
    expect(csv.slice(1)).toBe("A\r\n1");
  });
});

describe("buildExportFilename", () => {
  it("generates filename with report type and export date", () => {
    const filename = buildExportFilename("weekly");
    const today = new Date().toISOString().slice(0, 10);
    expect(filename).toBe(`weekly_${today}.csv`);
  });

  it("includes date range when provided", () => {
    const filename = buildExportFilename("kpi", "2026-01-01", "2026-03-31");
    const today = new Date().toISOString().slice(0, 10);
    expect(filename).toBe(`kpi_2026-01-01_2026-03-31_${today}.csv`);
  });
});

describe("streamCsvRows", () => {
  const columns = [
    { header: "ID", key: "id" },
    { header: "Name", key: "name" },
  ];

  it("yields BOM + header as first chunk", () => {
    const rows = [{ id: 1, name: "Alice" }];
    const gen = streamCsvRows(rows, columns);
    const first = gen.next().value;
    expect(first).toContain(UTF8_BOM);
    expect(first).toContain("ID,Name");
  });

  it("yields data in batches", () => {
    const rows = Array.from({ length: 5 }, (_, i) => ({ id: i, name: `User${i}` }));
    const gen = streamCsvRows(rows, columns, 2);

    const chunks: string[] = [];
    for (const chunk of gen) {
      chunks.push(chunk);
    }
    // 1 header + 3 data chunks (2+2+1)
    expect(chunks.length).toBe(4);
  });

  it("handles empty rows", () => {
    const gen = streamCsvRows([], columns);
    const chunks: string[] = [];
    for (const chunk of gen) chunks.push(chunk);
    // Just the header chunk
    expect(chunks.length).toBe(1);
  });
});
