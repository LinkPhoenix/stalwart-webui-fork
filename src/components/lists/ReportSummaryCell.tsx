/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { Badge } from '@/components/ui/badge';
import {
  getReportSummaryTone,
  getReportSummaryValue,
  REPORT_SUMMARY_COLUMNS,
} from '@/lib/reportSummaries';

interface ReportSummaryCellProps {
  colName: string;
  item: Record<string, unknown>;
  /** Optional enum label for ARF feedback type. */
  feedbackTypeLabel?: string;
}

/**
 * SCHEMA-DEVIATION: report-summary-columns (see SCHEMA_DEVIATIONS.md)
 *
 * Renders a report summary value; Quarantine / Reject / Failed Sessions
 * use coloured badges when the count is greater than zero so problems
 * are visible without opening the row.
 */
export function ReportSummaryCell({ colName, item, feedbackTypeLabel }: ReportSummaryCellProps) {
  const value = getReportSummaryValue(colName, item);

  if (colName === REPORT_SUMMARY_COLUMNS.arfFeedbackType) {
    const raw = String(value);
    if (raw === '-') return <span className="text-muted-foreground">-</span>;
    return <Badge variant="secondary">{feedbackTypeLabel ?? raw}</Badge>;
  }

  const tone = getReportSummaryTone(colName, value);
  if (tone === 'warn') {
    return (
      <Badge
        variant="outline"
        className="border-amber-500/40 bg-amber-500/15 font-semibold tabular-nums text-amber-800 dark:text-amber-300"
      >
        {value}
      </Badge>
    );
  }
  if (tone === 'danger') {
    return (
      <Badge variant="destructive" className="font-semibold tabular-nums">
        {value}
      </Badge>
    );
  }
  if (tone === 'muted') {
    return <span className="tabular-nums text-muted-foreground">{value}</span>;
  }
  return <span className="tabular-nums">{value}</span>;
}
