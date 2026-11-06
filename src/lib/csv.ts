/**
 * Minimal RFC 4180 CSV reader and writer for link import/export.
 */

/**
 * Spreadsheet apps execute cells that start with these characters as
 * formulas, so an exported link titled `=HYPERLINK(...)` could run when the
 * owner opens the file. Prefixing a quote neutralises it (OWASP guidance).
 */
const FORMULA_START = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  if (value === null || value === undefined) return "";
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (FORMULA_START.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv<T extends Record<string, unknown>>(
  rows: T[],
  columns: Array<keyof T & string>,
): string {
  const lines = [columns.join(",")];
  for (const row of rows) lines.push(columns.map((col) => escapeCell(row[col])).join(","));
  return `${lines.join("\r\n")}\r\n`;
}

/** Parse CSV text into rows of cells. Handles quotes, escaped quotes, CRLF and a BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += char;
    }
  }
  if (cell !== "" || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Parse CSV with a header row into objects keyed by lower-cased header names. */
export function parseCsvRecords(input: string): Array<Record<string, string>> {
  const [header, ...rows] = parseCsv(input);
  if (!header) return [];
  const keys = header.map((h) => h.trim().toLowerCase());
  return rows.map((cells) =>
    Object.fromEntries(keys.map((key, i) => [key, (cells[i] ?? "").trim()])),
  );
}
