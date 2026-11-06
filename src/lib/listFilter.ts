/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import type { Filter } from '@/types/schema';

const OP_SUFFIX = new Map<string, string>([
  ['eq', ''],
  ['gt', 'IsGreaterThan'],
  ['gte', 'IsGreaterThanOrEqual'],
  ['lt', 'IsLessThan'],
  ['lte', 'IsLessThanOrEqual'],
]);

export function isFilterOp(op: string): boolean {
  return OP_SUFFIX.has(op);
}

function opSuffix(op: string | undefined): string {
  return op ? (OP_SUFFIX.get(op) ?? '') : '';
}

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
    const suffix = isXPrefixed ? opSuffix(op) : '';
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

  filter[`${field}${opSuffix(effectiveOp)}`] = utcDayStart(value);
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
  const declared = new Map((filters ?? []).map((f) => [f.field, f]));

  for (const [key, val] of Object.entries(appliedFilters)) {
    if (val === '' || val == null) continue;
    const definition = declared.get(key);
    if (!definition) continue;

    const opKey = `${key}Op`;
    const op = Object.hasOwn(appliedFilters, opKey) ? appliedFilters[opKey] : undefined;

    if (definition.type === 'date') {
      applyDateFilter(filter, key, val, op, isXPrefixed);
      continue;
    }

    filter[`${key}${opSuffix(op)}`] = val;
  }

  if (filtersStatic) {
    Object.assign(filter, filtersStatic);
  }

  return filter;
}
