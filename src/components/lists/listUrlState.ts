/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { isFilterOp } from '@/lib/listFilter';

export interface ListSort {
  field: string;
  ascending: boolean;
}

export interface ListUrlState {
  filters: Record<string, string>;
  sort: ListSort | null;
  anchors: string[];
}

export const FILTER_PARAM_PREFIX = 'f.';
export const SORT_PARAM = 'sort';
export const SORT_DIR_PARAM = 'sortDir';
export const ANCHORS_PARAM = 'after';
const ANCHOR_SEPARATOR = ',';
const OP_SUFFIX = 'Op';
const DEFAULT_OP = 'eq';

export function normalizeFilters(values: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (value === '' || value == null) continue;
    if (key.endsWith(OP_SUFFIX)) {
      const base = key.slice(0, -OP_SUFFIX.length);
      if (value === DEFAULT_OP || !isFilterOp(value) || !Object.hasOwn(values, base) || !values[base]) continue;
    }
    out[key] = value;
  }
  return out;
}

export function parseListSearch(params: URLSearchParams): ListUrlState {
  const filters: Record<string, string> = {};
  params.forEach((value, key) => {
    if (key.startsWith(FILTER_PARAM_PREFIX) && key.length > FILTER_PARAM_PREFIX.length) {
      filters[key.slice(FILTER_PARAM_PREFIX.length)] = value;
    }
  });
  const sortField = params.get(SORT_PARAM);
  const sort = sortField ? { field: sortField, ascending: params.get(SORT_DIR_PARAM) !== 'desc' } : null;
  const anchors = (params.get(ANCHORS_PARAM) ?? '').split(ANCHOR_SEPARATOR).filter((id) => id.length > 0);
  return { filters: normalizeFilters(filters), sort, anchors };
}

export function serializeListSearch(state: ListUrlState): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(normalizeFilters(state.filters))) {
    params.set(`${FILTER_PARAM_PREFIX}${key}`, value);
  }
  if (state.sort) {
    params.set(SORT_PARAM, state.sort.field);
    params.set(SORT_DIR_PARAM, state.sort.ascending ? 'asc' : 'desc');
  }
  if (state.anchors.length > 0) {
    params.set(ANCHORS_PARAM, state.anchors.join(ANCHOR_SEPARATOR));
  }
  return params;
}

export function listStateKey(state: ListUrlState): string {
  return serializeListSearch(state).toString();
}

export function filtersKey(filters: Record<string, string>): string {
  return serializeListSearch({ filters, sort: null, anchors: [] }).toString();
}

export function nextSort(current: ListSort | null, field: string): ListSort | null {
  if (current?.field !== field) return { field, ascending: true };
  if (current.ascending) return { field, ascending: false };
  return null;
}

export function filteredListSearch(field: string, value: string): string {
  return serializeListSearch({ filters: { [field]: value }, sort: null, anchors: [] }).toString();
}
