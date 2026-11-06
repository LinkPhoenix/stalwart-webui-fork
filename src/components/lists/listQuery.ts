/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { buildJmapFilter } from '@/lib/listFilter';
import type { ListPageParams } from '@/data/keys';
import type { ResolvedSchema } from '@/lib/schemaResolver';
import type { Field, List } from '@/types/schema';
import type { ListSort, ListUrlState } from './listUrlState';

export const LIST_PAGE_SIZE = 25;

export type ListItem = Record<string, unknown>;

export function getListFields(resolvedSchema: ResolvedSchema): Record<string, Field> {
  if (resolvedSchema.type === 'single') return resolvedSchema.fields.properties;
  const merged: Record<string, Field> = {};
  for (const variant of resolvedSchema.variants) {
    if (variant.fields) Object.assign(merged, variant.fields.properties);
  }
  return merged;
}

export function buildListFilter(
  filters: Record<string, string>,
  list: Pick<List, 'filters' | 'filtersStatic'>,
  objectName: string,
): Record<string, unknown> | undefined {
  const filter = buildJmapFilter({
    appliedFilters: filters,
    filters: list.filters,
    filtersStatic: list.filtersStatic,
    isXPrefixed: objectName.startsWith('x:'),
  });
  return Object.keys(filter).length > 0 ? filter : undefined;
}

export function effectiveSort(sort: ListSort | null, list: Pick<List, 'sort'>): ListSort | null {
  return sort && list.sort?.includes(sort.field) ? sort : null;
}

export function buildListSort(sort: ListSort | null): Record<string, unknown>[] | undefined {
  return sort ? [{ property: sort.field, isAscending: sort.ascending }] : undefined;
}

export function buildListPageParams(
  state: ListUrlState,
  list: Pick<List, 'filters' | 'filtersStatic' | 'columns' | 'sort'>,
  objectName: string,
  pageSize = LIST_PAGE_SIZE,
  labelProperty?: string,
): ListPageParams {
  const properties = ['id', ...list.columns.map((c) => c.name)];
  if (labelProperty && !properties.includes(labelProperty)) properties.push(labelProperty);
  const params: ListPageParams = {
    filter: buildListFilter(state.filters, list, objectName),
    sort: buildListSort(effectiveSort(state.sort, list)),
    limit: pageSize,
    calculateTotal: true,
    properties,
  };
  const anchor = state.anchors[state.anchors.length - 1];
  if (anchor === undefined) {
    params.position = 0;
  } else {
    params.anchor = anchor;
    params.anchorOffset = 1;
  }
  return params;
}

export function isStrandedPage(anchors: number, count: number, settled: boolean): boolean {
  return settled && count === 0 && anchors > 0;
}

export function scalarText(value: unknown): string | null {
  if (typeof value === 'string') return value || null;
  if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'bigint') return String(value);
  return null;
}

export function itemId(item: ListItem): string | null {
  return typeof item.id === 'string' && item.id ? item.id : null;
}

export function itemLabel(item: ListItem, labelProperty: string): string {
  const value = item[labelProperty];
  if (typeof value === 'string' && value) return value;
  if (typeof value === 'number') return String(value);
  return itemId(item) ?? '';
}

export interface PageRange {
  from: number;
  to: number;
  hasPrev: boolean;
  hasNext: boolean;
}

export function pageRange(
  position: number,
  count: number,
  total: number | null,
  anchors: number,
  pageSize = LIST_PAGE_SIZE,
): PageRange {
  const start = position > 0 || anchors === 0 ? position : anchors * pageSize;
  return {
    from: count > 0 ? start + 1 : 0,
    to: start + count,
    hasPrev: anchors > 0,
    hasNext: total !== null ? start + count < total : count >= pageSize,
  };
}
