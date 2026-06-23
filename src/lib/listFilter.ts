/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Filter } from '@/types/schema';

const OP_SUFFIX: Record<string, string> = {
  eq: '',
  gt: 'IsGreaterThan',
  gte: 'IsGreaterThanOrEqual',
  lt: 'IsLessThan',
  lte: 'IsLessThanOrEqual',
};

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function utcDayStart(date: string): string {
  return `${date}T00:00:00Z`;
}

function utcNextDayStart(date: string): string {
  const dt = new Date(`${date}T00:00:00Z`);
  dt.setUTCDate(dt.getUTCDate() + 1);
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0');
  const d = String(dt.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}T00:00:00Z`;
}

function applyDateFilter(
  filter: Record<string, unknown>,
  field: string,
  value: string,
  op: string | undefined,
  isXPrefixed: boolean,
): void {
  if (!DATE_ONLY.test(value)) {
    const suffix = isXPrefixed && op ? (OP_SUFFIX[op] ?? '') : '';
    filter[`${field}${suffix}`] = value;
    return;
  }

  if (!isXPrefixed) {
    filter[field] = utcDayStart(value);
    return;
  }

  const effectiveOp = op ?? 'eq';
  if (effectiveOp === 'eq') {
    filter[`${field}IsGreaterThanOrEqual`] = utcDayStart(value);
    filter[`${field}IsLessThan`] = utcNextDayStart(value);
    return;
  }

  const suffix = OP_SUFFIX[effectiveOp] ?? '';
  filter[`${field}${suffix}`] = utcDayStart(value);
}

export interface BuildJmapFilterArgs {
  appliedFilters: Record<string, string>;
  filters?: Filter[];
  filtersStatic?: Record<string, unknown>;
  isXPrefixed: boolean;
}

export function buildJmapFilter({
  appliedFilters,
  filters,
  filtersStatic,
  isXPrefixed,
}: BuildJmapFilterArgs): Record<string, unknown> {
  const filter: Record<string, unknown> = {};
  if (filtersStatic) {
    Object.assign(filter, filtersStatic);
  }

  const dateFields = new Set((filters ?? []).filter((f) => f.type === 'date').map((f) => f.field));

  for (const [key, val] of Object.entries(appliedFilters)) {
    if (val === '' || val == null) continue;
    if (key.endsWith('Op')) continue;

    const op = appliedFilters[`${key}Op`];

    if (dateFields.has(key)) {
      applyDateFilter(filter, key, val, op, isXPrefixed);
      continue;
    }

    const suffix = op ? (OP_SUFFIX[op] ?? '') : '';
    filter[`${key}${suffix}`] = val;
  }

  return filter;
}
