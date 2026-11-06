/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useJmapListAll } from '@/data/listAll';
import { useJmapList } from '@/data/objects';
import { errorMessage } from '@/lib/jmapErrors';
import { JmapMethodError } from '@/services/errors';
import { useUIStore } from '@/stores/uiStore';
import type { List } from '@/types/schema';
import { planClientMode, processClientRows } from './clientList';
import {
  buildListFilter,
  buildListPageParams,
  buildListSort,
  isStrandedPage,
  itemId,
  pageRange,
  serverSort,
  type ListItem,
  type PageRange,
} from './listQuery';
import { listStateKey, nextSort, parseListSearch, serializeListSearch, type ListUrlState } from './listUrlState';

const EMPTY_ITEMS: ListItem[] = [];
const EMPTY_LIST: Pick<List, 'filters' | 'filtersStatic' | 'columns' | 'sort'> = { columns: [] };

export interface DynamicListState {
  state: ListUrlState;
  stateKey: string;
  items: ListItem[];
  total: number | null;
  range: PageRange;
  pageSize: number;
  jmapFilter: Record<string, unknown> | undefined;
  jmapSort: Record<string, unknown>[] | undefined;
  /** True when rows are fetched in full and filtered, sorted and paginated in the browser. */
  clientMode: boolean;
  /** Every row id matching the current view; only available in client mode. */
  allIds: string[] | null;
  /** Nesting depth per row id (mailbox tree); only available in client mode. */
  depths: ReadonlyMap<string, number> | null;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  applyFilters: (filters: Record<string, string>) => void;
  resetFilters: () => void;
  toggleSort: (field: string) => void;
  resetPage: () => void;
  nextPage: () => void;
  prevPage: () => void;
  refetch: () => void;
}

export function useDynamicList(
  objectName: string | undefined,
  list: List | null | undefined,
  labelProperty?: string,
): DynamicListState {
  const [searchParams, setSearchParams] = useSearchParams();
  const pageSize = useUIStore((s) => s.listPageSize);
  const state = parseListSearch(searchParams);
  const stateKey = listStateKey(state);
  const effectiveList = list ?? EMPTY_LIST;
  const enabledObject = list && objectName ? objectName : null;

  const plan = planClientMode(effectiveList, objectName ?? '', state);
  const pageParams = buildListPageParams(state, effectiveList, objectName ?? '', pageSize, labelProperty);

  const query = useJmapList(enabledObject, pageParams, { keepPrevious: true, enabled: !plan.client });

  // Fetch-all mode: one query for the whole server-side result, then every
  // filter, sort and page is computed locally.
  const allQuery = useJmapListAll(plan.client ? enabledObject : null, {
    filter: pageParams.filter,
    sort: pageParams.sort,
    properties: [...new Set([...(pageParams.properties ?? []), ...plan.filters.map((f) => f.field)])],
  });
  const processed = plan.client && allQuery.data ? processClientRows(allQuery.data, plan, objectName ?? '') : null;

  const anchorLost =
    !plan.client &&
    state.anchors.length > 0 &&
    query.error instanceof JmapMethodError &&
    query.error.type === 'anchorNotFound' &&
    !query.isFetching;

  const active = plan.client ? allQuery : query;
  let items: ListItem[];
  let total: number | null;
  let startPosition: number;
  if (plan.client) {
    const rows = processed?.items ?? EMPTY_ITEMS;
    const lastAnchor = state.anchors[state.anchors.length - 1];
    const anchorIndex = lastAnchor ? rows.findIndex((row) => itemId(row) === lastAnchor) : -1;
    startPosition = lastAnchor ? (anchorIndex === -1 ? rows.length : anchorIndex + 1) : 0;
    items = rows.slice(startPosition, startPosition + pageSize);
    total = processed ? rows.length : null;
  } else {
    items = query.data?.list ?? EMPTY_ITEMS;
    total = query.data?.total ?? null;
    startPosition = query.data?.position ?? 0;
  }

  const stranded = isStrandedPage(
    state.anchors.length,
    items.length,
    active.isSuccess && !active.isPlaceholderData && !active.isFetching,
  );
  const recovery = anchorLost ? 'reset' : stranded ? 'back' : null;

  useEffect(() => {
    if (!recovery) return;
    const current = parseListSearch(searchParams);
    const anchors = recovery === 'reset' ? [] : current.anchors.slice(0, -1);
    setSearchParams(serializeListSearch({ ...current, anchors }), { replace: true });
  }, [recovery, searchParams, setSearchParams]);

  const navigateTo = (next: ListUrlState) => {
    const params = serializeListSearch(next);
    if (params.toString() === stateKey) void active.refetch();
    else setSearchParams(params);
  };

  return {
    state,
    stateKey,
    items,
    total,
    range: pageRange(startPosition, items.length, total, state.anchors.length, pageSize),
    pageSize,
    jmapFilter: buildListFilter(state.filters, effectiveList, objectName ?? ''),
    jmapSort: buildListSort(serverSort(state.sort, effectiveList)),
    clientMode: plan.client,
    allIds: processed ? processed.items.flatMap((row) => itemId(row) ?? []) : null,
    depths: processed?.depths ?? null,
    isLoading: active.isPending && active.fetchStatus !== 'idle',
    isFetching: active.isFetching,
    error: active.isError && !anchorLost ? errorMessage(active.error) : null,
    applyFilters: (filters) => navigateTo({ filters, sort: state.sort, anchors: [] }),
    resetFilters: () => navigateTo({ filters: {}, sort: null, anchors: [] }),
    toggleSort: (field) => navigateTo({ filters: state.filters, sort: nextSort(state.sort, field), anchors: [] }),
    resetPage: () => navigateTo({ ...state, anchors: [] }),
    nextPage: () => {
      const last = items.length > 0 ? itemId(items[items.length - 1]) : null;
      if (last) navigateTo({ ...state, anchors: [...state.anchors, last] });
    },
    prevPage: () => {
      if (state.anchors.length > 0) navigateTo({ ...state, anchors: state.anchors.slice(0, -1) });
    },
    refetch: () => void active.refetch(),
  };
}
