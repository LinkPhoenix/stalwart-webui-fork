/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, it, expect } from 'vitest';
import {
  getReportSummaryValue,
  isReportSummaryColumn,
  listNeedsReportProperty,
  summarizeArfFeedbackType,
  summarizeArfIncidents,
  summarizeDmarcDispositions,
  summarizeTlsSessions,
} from './reportSummaries';

describe('summarizeDmarcDispositions', () => {
  it('sums pass + none into Pass, and quarantine/reject separately', () => {
    const report = {
      records: {
        '1': { count: 10, evaluatedDisposition: 'pass' },
        '2': { count: 3, evaluatedDisposition: 'none' },
        '3': { count: 5, evaluatedDisposition: 'quarantine' },
        '4': { count: 2, evaluatedDisposition: 'reject' },
        '5': { count: 7, evaluatedDisposition: 'unspecified' },
      },
    };
    expect(summarizeDmarcDispositions(report)).toEqual({
      pass: 13,
      quarantine: 5,
      reject: 2,
    });
  });

  it('returns zeros for missing/empty report', () => {
    expect(summarizeDmarcDispositions(null)).toEqual({ pass: 0, quarantine: 0, reject: 0 });
    expect(summarizeDmarcDispositions({})).toEqual({ pass: 0, quarantine: 0, reject: 0 });
  });
});

describe('summarizeTlsSessions', () => {
  it('sums successful and failed sessions across policies', () => {
    const report = {
      policies: {
        a: { totalSuccessfulSessions: 100, totalFailedSessions: 4 },
        b: { totalSuccessfulSessions: 50, totalFailedSessions: 6 },
      },
    };
    expect(summarizeTlsSessions(report)).toEqual({ successful: 150, failed: 10 });
  });

  it('returns zeros for missing report', () => {
    expect(summarizeTlsSessions(undefined)).toEqual({ successful: 0, failed: 0 });
  });
});

describe('summarizeArf', () => {
  it('reads incidents and feedback type', () => {
    expect(summarizeArfIncidents({ incidents: 3, feedbackType: 'abuse' })).toBe(3);
    expect(summarizeArfFeedbackType({ incidents: 3, feedbackType: 'abuse' })).toBe('abuse');
    expect(summarizeArfFeedbackType({})).toBe('-');
  });
});

describe('getReportSummaryValue / column helpers', () => {
  it('resolves synthetic columns from item.report', () => {
    const item = {
      id: '1',
      report: {
        records: {
          '1': { count: 4, evaluatedDisposition: 'pass' },
          '2': { count: 1, evaluatedDisposition: 'reject' },
        },
        policies: {
          p: { totalSuccessfulSessions: 9, totalFailedSessions: 1 },
        },
        incidents: 2,
        feedbackType: 'fraud',
      },
    };
    expect(getReportSummaryValue('dmarcPassCount', item)).toBe(4);
    expect(getReportSummaryValue('dmarcRejectCount', item)).toBe(1);
    expect(getReportSummaryValue('tlsSuccessfulSessions', item)).toBe(9);
    expect(getReportSummaryValue('tlsFailedSessions', item)).toBe(1);
    expect(getReportSummaryValue('arfIncidents', item)).toBe(2);
    expect(getReportSummaryValue('arfFeedbackType', item)).toBe('fraud');
  });

  it('detects report-summary columns and list property need', () => {
    expect(isReportSummaryColumn('dmarcPassCount')).toBe(true);
    expect(isReportSummaryColumn('from')).toBe(false);
    expect(listNeedsReportProperty([{ name: 'from' }, { name: 'dmarcPassCount' }])).toBe(true);
    expect(listNeedsReportProperty([{ name: 'from' }])).toBe(false);
  });
});
