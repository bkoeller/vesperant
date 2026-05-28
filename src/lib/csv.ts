/**
 * RFC-4180 CSV serializer. Wraps a value in double quotes only when needed
 * (comma, quote, CR, or LF) and doubles up any embedded quotes. Arrays are
 * joined with "; " — readable in Excel/Sheets without forcing a second
 * normalized table.
 */
export type CsvCell = string | number | boolean | null | undefined | string[];

export function escapeCell(value: CsvCell): string {
  if (value === null || value === undefined) return '';
  let s: string;
  if (Array.isArray(value)) {
    s = value.join('; ');
  } else if (typeof value === 'boolean') {
    s = value ? 'true' : 'false';
  } else {
    s = String(value);
  }
  if (s === '') return '';
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function toCsv<T extends Record<string, CsvCell>>(rows: T[], columns: (keyof T)[]): string {
  const header = columns.map(c => escapeCell(String(c))).join(',');
  const body = rows.map(r => columns.map(c => escapeCell(r[c])).join(',')).join('\r\n');
  // Trailing CRLF is conventional (RFC 4180 §2) and avoids some tools
  // mis-parsing the last row.
  return rows.length > 0 ? `${header}\r\n${body}\r\n` : `${header}\r\n`;
}

/**
 * Trigger a browser download of `content` as `filename`. Prepends a UTF-8
 * BOM so Excel opens the file with the right encoding (otherwise non-ASCII
 * characters in cocktail/bottle names render mojibake).
 */
export function downloadCsv(filename: string, content: string): void {
  const bom = '﻿';
  const blob = new Blob([bom + content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Date-stamped filename like "vesperant-bottles-2026-05-27.csv".
 */
export function csvFilename(dataset: string, now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `vesperant-${dataset}-${yyyy}-${mm}-${dd}.csv`;
}
