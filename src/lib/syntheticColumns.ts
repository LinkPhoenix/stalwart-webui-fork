import { getReportSummaryValue, isReportSummaryColumn } from '@/lib/reportSummaries';

/**
 * SCHEMA-DEVIATION: account-quota-usage-column, account-alias-count-column,
 * role-permission-count-columns, report-summary-columns
 * (see SCHEMA_DEVIATIONS.md)
 *
 * Synthetic list columns are not server properties: the schema patches in
 * lib/*Columns.ts add them, and the list resolves each one to the real
 * properties it needs (`expandListProperties`), renders it
 * (components/lists/SyntheticCell) and sorts on it (`getClientSortValue`).
 */

export const QUOTA_USAGE_COLUMN = 'quotaUsage';

/** Count columns, keyed by column name, naming the set/objectList property they count. */
export const COUNT_COLUMN_SOURCES: Record<string, string> = {
  aliasCount: 'aliases',
  enabledPermissionCount: 'enabledPermissions',
  disabledPermissionCount: 'disabledPermissions',
};

export function isSyntheticColumn(name: string): boolean {
  return name === QUOTA_USAGE_COLUMN || name in COUNT_COLUMN_SOURCES || isReportSummaryColumn(name);
}

/** Columns rendered by components/lists/SyntheticCell instead of the schema-driven pipeline. */
export function hasSyntheticCell(column: string, objectName: string): boolean {
  return isSyntheticColumn(column) || (column === 'roles' && objectName === 'x:Account');
}

/** Real JMAP properties to request for a list's (possibly synthetic) columns. */
export function expandListProperties(columns: ReadonlyArray<{ name: string }>, objectName: string): string[] {
  const properties = new Set<string>(['id']);
  let needsReport = false;
  for (const { name } of columns) {
    if (name === QUOTA_USAGE_COLUMN) {
      properties.add('usedDiskQuota');
      properties.add('quotas');
    } else if (name in COUNT_COLUMN_SOURCES) {
      properties.add(COUNT_COLUMN_SOURCES[name]);
    } else if (isReportSummaryColumn(name)) {
      needsReport = true;
    } else {
      properties.add(name);
    }
  }
  if (needsReport) properties.add('report');
  // SCHEMA-DEVIATION: mailbox-client-hierarchy-sort
  if (objectName === 'Mailbox') properties.add('parentId');
  return [...properties];
}

export function computeQuotaUsage(item: Record<string, unknown>): { used: number; limit: number } {
  const rawUsed = typeof item.usedDiskQuota === 'number' ? item.usedDiskQuota : 0;
  const used = Number.isFinite(rawUsed) ? rawUsed : 0;
  const quotas = item.quotas as Record<string, unknown> | undefined;
  const rawLimit = quotas && typeof quotas.maxDiskQuota === 'number' ? quotas.maxDiskQuota : 0;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 0;
  return { used, limit };
}

export function getCountColumnValue(colName: string, item: Record<string, unknown>): number {
  const source = COUNT_COLUMN_SOURCES[colName];
  const entries = item[source];
  return entries && typeof entries === 'object' ? Object.keys(entries).length : 0;
}

/** Comparable value for a column, used by client-side sorting. */
export function getClientSortValue(colName: string, item: Record<string, unknown>): string | number {
  if (colName === QUOTA_USAGE_COLUMN) return computeQuotaUsage(item).used;
  if (colName in COUNT_COLUMN_SOURCES) return getCountColumnValue(colName, item);
  if (isReportSummaryColumn(colName)) return getReportSummaryValue(colName, item);
  const raw = item[colName];
  return typeof raw === 'number' ? raw : String(raw ?? '');
}
