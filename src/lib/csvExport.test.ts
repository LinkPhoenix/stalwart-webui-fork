import { describe, expect, it } from 'vitest';
import { buildCsv, escapeCsvField } from './csvExport';

describe('escapeCsvField', () => {
  it.each(['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '＝1+1', '＋1+2', '－1+2', '＠SUM(A1)', '  =1+1', '\t@SUM(A1)'])(
    'marks formula-like values as text: %s',
    (value) => {
      expect(escapeCsvField(value)).toBe(`"'${value}"`);
    },
  );

  it('quotes every value and escapes embedded quotes', () => {
    expect(escapeCsvField('a,"b"')).toBe('"a,""b"""');
    expect(escapeCsvField('')).toBe('""');
  });

  it('does not alter ordinary values', () => {
    expect(escapeCsvField('alice@example.com')).toBe('"alice@example.com"');
    expect(escapeCsvField('42')).toBe('"42"');
  });
});

describe('buildCsv', () => {
  it('quotes headers and rows and uses RFC 4180 line endings', () => {
    expect(buildCsv(['Name', 'Value'], [['Alice', '=1+1']])).toBe('"Name","Value"\r\n"Alice","\'=1+1"');
  });

  it('preserves multiline and comma-containing values inside quoted cells', () => {
    expect(buildCsv(['Name'], [['line one,\nline two']])).toBe('"Name"\r\n"line one,\nline two"');
  });
});
