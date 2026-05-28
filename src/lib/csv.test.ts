import { describe, it, expect } from 'vitest';
import { escapeCell, toCsv, csvFilename } from './csv';

describe('escapeCell', () => {
  it('renders nullish and empty as empty string', () => {
    expect(escapeCell(null)).toBe('');
    expect(escapeCell(undefined)).toBe('');
    expect(escapeCell('')).toBe('');
  });

  it('passes plain strings through unquoted', () => {
    expect(escapeCell('Negroni')).toBe('Negroni');
  });

  it('quotes values containing commas', () => {
    expect(escapeCell('Carpano Antica, Sweet')).toBe('"Carpano Antica, Sweet"');
  });

  it('quotes and doubles internal quotes', () => {
    expect(escapeCell('A 1.75" pour')).toBe('"A 1.75"" pour"');
  });

  it('quotes values containing newlines (tasting notes)', () => {
    expect(escapeCell('Nose: smoke.\nPalate: brine.')).toBe('"Nose: smoke.\nPalate: brine."');
    expect(escapeCell('a\rb')).toBe('"a\rb"');
  });

  it('joins string arrays with "; "', () => {
    expect(escapeCell(['Islay', 'peated', 'cask strength'])).toBe('Islay; peated; cask strength');
  });

  it('quotes joined array values if any element introduces a comma', () => {
    expect(escapeCell(['a, b', 'c'])).toBe('"a, b; c"');
  });

  it('serializes numbers and booleans', () => {
    expect(escapeCell(46)).toBe('46');
    expect(escapeCell(true)).toBe('true');
    expect(escapeCell(false)).toBe('false');
    expect(escapeCell(0)).toBe('0');
  });
});

describe('toCsv', () => {
  it('writes a header row even when there are zero rows', () => {
    const csv = toCsv<{ name: string; abv: number | null }>([], ['name', 'abv']);
    expect(csv).toBe('name,abv\r\n');
  });

  it('writes header + body with CRLF line endings', () => {
    const csv = toCsv(
      [
        { name: 'Hendricks', abv: 41.4 },
        { name: 'Tanqueray', abv: 47.3 },
      ],
      ['name', 'abv'],
    );
    expect(csv).toBe('name,abv\r\nHendricks,41.4\r\nTanqueray,47.3\r\n');
  });

  it('only includes selected columns, in the requested order', () => {
    const csv = toCsv(
      [{ name: 'Hendricks', abv: 41.4, brand: 'William Grant', extra: 'ignored' }],
      ['brand', 'name'],
    );
    expect(csv).toBe('brand,name\r\nWilliam Grant,Hendricks\r\n');
  });

  it('handles missing fields as empty cells', () => {
    const csv = toCsv<{ name: string; notes: string | null }>(
      [{ name: 'Hendricks', notes: null }],
      ['name', 'notes'],
    );
    expect(csv).toBe('name,notes\r\nHendricks,\r\n');
  });
});

describe('csvFilename', () => {
  it('formats a dated filename', () => {
    const d = new Date(2026, 4, 27);
    expect(csvFilename('bottles', d)).toBe('vesperant-bottles-2026-05-27.csv');
  });

  it('zero-pads single-digit months and days', () => {
    const d = new Date(2026, 0, 3);
    expect(csvFilename('history', d)).toBe('vesperant-history-2026-01-03.csv');
  });
});
