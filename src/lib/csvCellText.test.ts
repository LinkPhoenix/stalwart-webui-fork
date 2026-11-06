import { describe, expect, it } from 'vitest';
import type { Field, Schema } from '@/types/schema';
import { csvCellText, type CsvTextContext } from './csvCellText';

const schema = {
  objects: {},
  schemas: {
    'x:UserRoles': { type: 'multiple', variants: [{ name: 'User', label: 'User role' }] },
  },
  fields: {},
  forms: {},
  lists: {},
  enums: { Level: [{ name: 'error', label: 'Error' }] },
  dashboards: [],
  layouts: [],
} as unknown as Schema;

const fields: Record<string, Field> = {
  enabled: { type: { type: 'boolean' } } as Field,
  level: { type: { type: 'enum', enumName: 'Level' } } as Field,
  size: { type: { type: 'number', format: 'unsignedInteger' } } as Field,
  tags: { type: { type: 'set', class: { type: 'string' } } } as unknown as Field,
};

const ctx: CsvTextContext = {
  schema,
  objectName: 'x:Account',
  fields,
  labels: { yes: 'Yes', no: 'No', unlimited: '∞' },
};

const text = (column: string, item: Record<string, unknown>) => csvCellText(column, item, ctx, new Map());

describe('csvCellText', () => {
  it('formats synthetic columns like the table', () => {
    expect(text('quotaUsage', { usedDiskQuota: 1024, quotas: { maxDiskQuota: 2048 } })).toBe('1 KB / 2 KB');
    expect(text('quotaUsage', { usedDiskQuota: 0 })).toBe('0 B / ∞');
    expect(text('aliasCount', { aliases: { a: true, b: true } })).toBe('2');
    expect(text('roles', { roles: { '@type': 'User' } })).toBe('User role');
  });

  it('formats schema-driven values', () => {
    expect(text('enabled', { enabled: true })).toBe('Yes');
    expect(text('enabled', { enabled: false })).toBe('No');
    expect(text('level', { level: 'error' })).toBe('Error');
    expect(text('size', { size: 2048 })).toBe('2 KB');
    expect(text('tags', { tags: { a: true, b: true } })).toBe('a, b');
    expect(text('missing', {})).toBe('');
  });
});
