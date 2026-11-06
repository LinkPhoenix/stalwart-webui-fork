import { loadDisplayName } from '@/data/displayNames';
import { effectiveNumberFormat } from '@/lib/byteSizeFormat';
import { formatDateTime, formatDuration, formatNumber, formatSize } from '@/lib/format';
import { REPORT_SUMMARY_COLUMNS, getReportSummaryValue, isReportSummaryColumn } from '@/lib/reportSummaries';
import { getDisplayProperty } from '@/lib/schemaResolver';
import {
  COUNT_COLUMN_SOURCES,
  QUOTA_USAGE_COLUMN,
  computeQuotaUsage,
  getCountColumnValue,
} from '@/lib/syntheticColumns';
import type { Field, Schema } from '@/types/schema';

export interface CsvTextContext {
  schema: Schema;
  objectName: string;
  fields: Record<string, Field>;
  labels: { yes: string; no: string; unlimited: string };
}

type Item = Record<string, unknown>;

function enumLabel(schema: Schema, enumName: string, value: string): string {
  return schema.enums[enumName]?.find((variant) => variant.name === value)?.label ?? value;
}

function variantLabel(schema: Schema, objectName: string, type: string): string {
  const entry = schema.schemas[objectName];
  if (entry?.type === 'multiple') return entry.variants.find((variant) => variant.name === type)?.label ?? type;
  return type;
}

/**
 * Text of one cell, mirroring what the table shows. `idLabels` holds the
 * resolved display names of object ids (see resolveCsvIdLabels).
 */
export function csvCellText(
  column: string,
  item: Item,
  ctx: CsvTextContext,
  idLabels: ReadonlyMap<string, string>,
): string {
  const { schema, objectName, fields } = ctx;

  if (column === QUOTA_USAGE_COLUMN) {
    const { used, limit } = computeQuotaUsage(item);
    return `${formatSize(used)} / ${limit ? formatSize(limit) : ctx.labels.unlimited}`;
  }
  if (column in COUNT_COLUMN_SOURCES) return String(getCountColumnValue(column, item));
  if (isReportSummaryColumn(column)) {
    const value = String(getReportSummaryValue(column, item));
    if (column === REPORT_SUMMARY_COLUMNS.arfFeedbackType) {
      return value === '-' ? '' : enumLabel(schema, 'ArfFeedbackType', value);
    }
    return value;
  }
  if (column === 'roles' && objectName === 'x:Account') {
    const type = (item.roles as Record<string, unknown> | undefined)?.['@type'];
    return typeof type === 'string' ? variantLabel(schema, 'x:UserRoles', type) : '';
  }

  const value = item[column];
  if (value == null) return '';
  if (column === '@type' && typeof value === 'string') return variantLabel(schema, objectName, value);

  const field = fields[column];
  if (!field) return typeof value === 'object' ? '' : String(value);
  const type = field.type;

  switch (type.type) {
    case 'boolean':
      return value ? ctx.labels.yes : ctx.labels.no;
    case 'number': {
      if (typeof value !== 'number') return String(value);
      const format = effectiveNumberFormat(column, type.format);
      if (format === 'size') return formatSize(value);
      if (format === 'duration') return formatDuration(value);
      return formatNumber(value);
    }
    case 'utcDateTime':
      return typeof value === 'string' || typeof value === 'number' ? formatDateTime(value) : String(value);
    case 'enum':
      return enumLabel(schema, type.enumName, String(value));
    case 'objectId':
      return idLabels.get(`${type.objectName}\u0000${String(value)}`) ?? String(value);
    case 'set': {
      if (!value || typeof value !== 'object') return '';
      const keys = Object.keys(value as Record<string, unknown>);
      const enumName = type.class.type === 'enum' ? type.class.enumName : undefined;
      return keys.map((key) => (enumName ? enumLabel(schema, enumName, key) : key)).join(', ');
    }
    case 'object': {
      const objectType = (value as Record<string, unknown>)['@type'];
      return typeof objectType === 'string' ? variantLabel(schema, type.objectName, objectType) : '';
    }
    default:
      return typeof value === 'object' ? '' : String(value);
  }
}

/** Resolves the display names of every object id the exported cells reference. */
export async function resolveCsvIdLabels(
  rows: Item[],
  columns: ReadonlyArray<{ name: string }>,
  ctx: Pick<CsvTextContext, 'schema' | 'fields'>,
): Promise<Map<string, string>> {
  const wanted = new Map<string, { objectName: string; id: string }>();
  for (const { name } of columns) {
    const type = ctx.fields[name]?.type;
    if (type?.type !== 'objectId') continue;
    for (const row of rows) {
      const id = row[name];
      if (typeof id === 'string' && id)
        wanted.set(`${type.objectName}\u0000${id}`, { objectName: type.objectName, id });
    }
  }
  const labels = new Map<string, string>();
  await Promise.all(
    [...wanted].map(async ([key, { objectName, id }]) => {
      try {
        const label = await loadDisplayName(objectName, getDisplayProperty(ctx.schema, objectName), id);
        if (label) labels.set(key, label);
      } catch {
        // Fall back to the raw id.
      }
    }),
  );
  return labels;
}
