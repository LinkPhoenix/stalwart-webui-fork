/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

/**
 * SCHEMA-DEVIATION: report-summary-columns (see SCHEMA_DEVIATIONS.md)
 *
 * Pure helpers that turn the nested `report` object on DMARC/TLS/ARF
 * report rows into the summary numbers/labels shown as list columns.
 * Kept free of React so the same logic can be unit-tested and reused by
 * DynamicList (render + client-sort).
 */

/** Synthetic column names injected by `withReportListColumns`. */
export const REPORT_SUMMARY_COLUMNS = {
  dmarcPassCount: 'dmarcPassCount',
  dmarcQuarantineCount: 'dmarcQuarantineCount',
  dmarcRejectCount: 'dmarcRejectCount',
  tlsSuccessfulSessions: 'tlsSuccessfulSessions',
  tlsFailedSessions: 'tlsFailedSessions',
  arfIncidents: 'arfIncidents',
  arfFeedbackType: 'arfFeedbackType',
} as const;

export type ReportSummaryColumn = (typeof REPORT_SUMMARY_COLUMNS)[keyof typeof REPORT_SUMMARY_COLUMNS];

const REPORT_SUMMARY_COLUMN_SET = new Set<string>(Object.values(REPORT_SUMMARY_COLUMNS));

export function isReportSummaryColumn(name: string): boolean {
  return REPORT_SUMMARY_COLUMN_SET.has(name);
}

/** Any list that declares at least one report-summary column needs `report` fetched. */
export function listNeedsReportProperty(columns: Array<{ name: string }>): boolean {
  return columns.some((c) => isReportSummaryColumn(c.name));
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value != null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/** objectList / List wire format: id-keyed map of row objects. */
function objectListEntries(value: unknown): Record<string, unknown>[] {
  const map = asRecord(value);
  if (!map) return [];
  return Object.values(map).filter((v): v is Record<string, unknown> => asRecord(v) != null);
}

function recordCount(record: Record<string, unknown>): number {
  return typeof record.count === 'number' ? record.count : 0;
}

/**
 * Aggregate DMARC record counts by evaluated disposition.
 * Pass includes both `pass` and `none` (per webui#13).
 */
export function summarizeDmarcDispositions(report: unknown): {
  pass: number;
  quarantine: number;
  reject: number;
} {
  const root = asRecord(report);
  const totals = { pass: 0, quarantine: 0, reject: 0 };
  if (!root) return totals;

  for (const record of objectListEntries(root.records)) {
    const n = recordCount(record);
    const disposition = String(record.evaluatedDisposition ?? '').toLowerCase();
    if (disposition === 'pass' || disposition === 'none') {
      totals.pass += n;
    } else if (disposition === 'quarantine') {
      totals.quarantine += n;
    } else if (disposition === 'reject') {
      totals.reject += n;
    }
  }
  return totals;
}

/** Sum successful/failed TLS sessions across every policy in the report. */
export function summarizeTlsSessions(report: unknown): {
  successful: number;
  failed: number;
} {
  const root = asRecord(report);
  const totals = { successful: 0, failed: 0 };
  if (!root) return totals;

  for (const policy of objectListEntries(root.policies)) {
    if (typeof policy.totalSuccessfulSessions === 'number') {
      totals.successful += policy.totalSuccessfulSessions;
    }
    if (typeof policy.totalFailedSessions === 'number') {
      totals.failed += policy.totalFailedSessions;
    }
  }
  return totals;
}

export function summarizeArfIncidents(report: unknown): number {
  const root = asRecord(report);
  return typeof root?.incidents === 'number' ? root.incidents : 0;
}

export function summarizeArfFeedbackType(report: unknown): string {
  const root = asRecord(report);
  const value = root?.feedbackType;
  return typeof value === 'string' && value.length > 0 ? value : '-';
}

/** Resolve a synthetic report-summary column to a display/sort value. */
export function getReportSummaryValue(
  colName: string,
  item: Record<string, unknown>,
): string | number {
  const report = item.report;
  switch (colName) {
    case REPORT_SUMMARY_COLUMNS.dmarcPassCount:
      return summarizeDmarcDispositions(report).pass;
    case REPORT_SUMMARY_COLUMNS.dmarcQuarantineCount:
      return summarizeDmarcDispositions(report).quarantine;
    case REPORT_SUMMARY_COLUMNS.dmarcRejectCount:
      return summarizeDmarcDispositions(report).reject;
    case REPORT_SUMMARY_COLUMNS.tlsSuccessfulSessions:
      return summarizeTlsSessions(report).successful;
    case REPORT_SUMMARY_COLUMNS.tlsFailedSessions:
      return summarizeTlsSessions(report).failed;
    case REPORT_SUMMARY_COLUMNS.arfIncidents:
      return summarizeArfIncidents(report);
    case REPORT_SUMMARY_COLUMNS.arfFeedbackType:
      return summarizeArfFeedbackType(report);
    default:
      return '-';
  }
}

/**
 * Visual tone for attention-grabbing report summary cells.
 * Quarantine → warn (amber); Reject / Failed Sessions → danger (red);
 * zero counts stay muted/plain so only problems stand out.
 */
export type ReportSummaryTone = 'muted' | 'warn' | 'danger' | 'plain';

export function getReportSummaryTone(colName: string, value: string | number): ReportSummaryTone {
  if (colName === REPORT_SUMMARY_COLUMNS.arfFeedbackType) return 'plain';

  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n) || n <= 0) return 'muted';

  switch (colName) {
    case REPORT_SUMMARY_COLUMNS.dmarcQuarantineCount:
      return 'warn';
    case REPORT_SUMMARY_COLUMNS.dmarcRejectCount:
    case REPORT_SUMMARY_COLUMNS.tlsFailedSessions:
      return 'danger';
    default:
      return 'plain';
  }
}
