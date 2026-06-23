/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { describe, it, expect } from 'vitest';
import { buildJmapFilter } from './listFilter';
import type { Filter } from '@/types/schema';

const dateFilter: Filter = { type: 'date', field: 'timestamp', label: 'Date' };
const textFilter: Filter = { type: 'text', field: 'text', label: 'Text' };
const intFilter: Filter = { type: 'integer', field: 'size', label: 'Size' };

describe('buildJmapFilter', () => {
  it('returns an empty object when nothing is applied', () => {
    expect(buildJmapFilter({ appliedFilters: {}, isXPrefixed: true })).toEqual({});
  });

  it('merges filtersStatic', () => {
    const filter = buildJmapFilter({
      appliedFilters: {},
      filtersStatic: { hasErrors: true },
      isXPrefixed: true,
    });
    expect(filter).toEqual({ hasErrors: true });
  });

  it('skips empty and Op-only keys', () => {
    const filter = buildJmapFilter({
      appliedFilters: { text: '', textOp: 'eq' },
      filters: [textFilter],
      isXPrefixed: true,
    });
    expect(filter).toEqual({});
  });

  it('passes text filters through verbatim', () => {
    const filter = buildJmapFilter({
      appliedFilters: { text: 'hello' },
      filters: [textFilter],
      isXPrefixed: true,
    });
    expect(filter).toEqual({ text: 'hello' });
  });

  it('applies the operator suffix for integer filters', () => {
    const filter = buildJmapFilter({
      appliedFilters: { size: '1024', sizeOp: 'gt' },
      filters: [intFilter],
      isXPrefixed: true,
    });
    expect(filter).toEqual({ sizeIsGreaterThan: '1024' });
  });

  describe('date filters (x-prefixed, with operator UI)', () => {
    it('expands a default date-only equality into a full-day range', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-17' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({
        timestampIsGreaterThanOrEqual: '2026-06-17T00:00:00Z',
        timestampIsLessThan: '2026-06-18T00:00:00Z',
      });
    });

    it('treats an explicit eq operator the same as the default', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-17', timestampOp: 'eq' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({
        timestampIsGreaterThanOrEqual: '2026-06-17T00:00:00Z',
        timestampIsLessThan: '2026-06-18T00:00:00Z',
      });
    });

    it('appends midnight UTC for the After (gt) operator', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-17', timestampOp: 'gt' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({ timestampIsGreaterThan: '2026-06-17T00:00:00Z' });
    });

    it('appends midnight UTC for the Before (lt) operator', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-17', timestampOp: 'lt' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({ timestampIsLessThan: '2026-06-17T00:00:00Z' });
    });

    it('rolls over month boundaries', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-30' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({
        timestampIsGreaterThanOrEqual: '2026-06-30T00:00:00Z',
        timestampIsLessThan: '2026-07-01T00:00:00Z',
      });
    });

    it('rolls over year boundaries', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-12-31' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({
        timestampIsGreaterThanOrEqual: '2026-12-31T00:00:00Z',
        timestampIsLessThan: '2027-01-01T00:00:00Z',
      });
    });

    it('handles leap-year February', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2028-02-28' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({
        timestampIsGreaterThanOrEqual: '2028-02-28T00:00:00Z',
        timestampIsLessThan: '2028-02-29T00:00:00Z',
      });
    });

    it('passes a full datetime through with only the operator suffix applied', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-17T08:30:00Z', timestampOp: 'gt' },
        filters: [dateFilter],
        isXPrefixed: true,
      });
      expect(filter).toEqual({ timestampIsGreaterThan: '2026-06-17T08:30:00Z' });
    });
  });

  describe('date filters (non-x-prefixed, no operator UI)', () => {
    it('appends midnight UTC as an exact match without range expansion', () => {
      const filter = buildJmapFilter({
        appliedFilters: { timestamp: '2026-06-17' },
        filters: [dateFilter],
        isXPrefixed: false,
      });
      expect(filter).toEqual({ timestamp: '2026-06-17T00:00:00Z' });
    });
  });
});
