/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Schema } from '@/types/schema';
import { clientSortable } from './schemaDeviationTypes';
import { REPORT_SUMMARY_COLUMNS } from './reportSummaries';

/**
 * SCHEMA-DEVIATION: report-summary-columns (see SCHEMA_DEVIATIONS.md)
 *
 * DMARC/TLS/ARF report lists only show envelope metadata (From/Subject/
 * Received), so admins must open each report to see whether it needs
 * attention. Injects synthetic summary columns resolved by DynamicList
 * from the real nested `report` property (disposition counts for DMARC,
 * session totals for TLS, incidents + feedback type for ARF).
 *
 * Also applied to outbound (internal) DMARC/TLS lists, which carry the
 * same nested `report` shape.
 *
 * Columns are tagged `clientSortable` — report lists declare no
 * `list.sort`, so sorting goes through the same client-sort path as
 * Accounts/Roles (SCHEMA-DEVIATION: account-client-sort).
 */
export function withReportListColumns(schema: Schema): Schema {
  let lists = schema.lists;

  const patch = (
    key: string,
    extra: Array<{ name: string; label: string }>,
  ): void => {
    const list = lists[key];
    if (!list) return;
    lists = {
      ...lists,
      [key]: {
        ...list,
        columns: [...list.columns, ...extra.map((c) => clientSortable(c))],
      },
    };
  };

  const dmarcCols = [
    { name: REPORT_SUMMARY_COLUMNS.dmarcPassCount, label: 'Pass' },
    { name: REPORT_SUMMARY_COLUMNS.dmarcQuarantineCount, label: 'Quarantine' },
    { name: REPORT_SUMMARY_COLUMNS.dmarcRejectCount, label: 'Reject' },
  ];
  patch('x:DmarcExternalReport', dmarcCols);
  patch('x:DmarcInternalReport', dmarcCols);

  const tlsCols = [
    { name: REPORT_SUMMARY_COLUMNS.tlsSuccessfulSessions, label: 'Successful Sessions' },
    { name: REPORT_SUMMARY_COLUMNS.tlsFailedSessions, label: 'Failed Sessions' },
  ];
  patch('x:TlsExternalReport', tlsCols);
  patch('x:TlsInternalReport', tlsCols);

  patch('x:ArfExternalReport', [
    { name: REPORT_SUMMARY_COLUMNS.arfIncidents, label: 'Incidents' },
    { name: REPORT_SUMMARY_COLUMNS.arfFeedbackType, label: 'Feedback Type' },
  ]);

  return lists === schema.lists ? schema : { ...schema, lists };
}
