/*
 * SPDX-FileCopyrightText: 2020 Stalwart Labs LLC <hello@stalw.art>
 *
 * SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-SEL
 */

import { useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';

import { useJmapList } from '@/data/objects';
import { errorMessage } from '@/lib/jmapErrors';
import { JmapMethodError } from '@/services/errors';
import type { List } from '@/types/schema';
import {
  LIST_PAGE_SIZE,
  buildListFilter,
  buildListPageParams,
  buildListSort,
  effectiveSort,
  isStrandedPage,
  itemId,
  pageRange,
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
  jmapFilter: Record<string, unknown> | undefined;
  jmapSort: Record<string, unknown>[] | undefined;
  isLoading: boolean;
  isFetching: boolean;
  error: string | null;
  applyFilters: (filters: Record<string, string>) => void;
  resetFilters: () => void;
  toggleSort: (field: string) => void;
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
  const state = parseListSearch(searchParams);
  const stateKey = listStateKey(state);
  const effectiveList = list ?? EMPTY_LIST;
  const enabledObject = list && objectName ? objectName : null;

  const query = useJmapList(
    enabledObject,
    buildListPageParams(state, effectiveList, objectName ?? '', LIST_PAGE_SIZE, labelProperty),
    { keepPrevious: true },
  );

  const anchorLost =
    state.anchors.length > 0 &&
    query.error instanceof JmapMethodError &&
    query.error.type === 'anchorNotFound' &&
    !query.isFetching;

  const stranded = isStrandedPage(
    state.anchors.length,
    query.data?.list.length ?? 0,
    query.isSuccess && !query.isPlaceholderData && !query.isFetching,
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
    if (params.toString() === stateKey) void query.refetch();
    else setSearchParams(params);
  };

  const items = query.data?.list ?? EMPTY_ITEMS;
  const total = query.data?.total ?? null;
  const position = query.data?.position ?? 0;

  return {
    state,
    stateKey,
    items,
    total,
    range: pageRange(position, items.length, total, state.anchors.length, LIST_PAGE_SIZE),
    jmapFilter: buildListFilter(state.filters, effectiveList, objectName ?? ''),
    jmapSort: buildListSort(effectiveSort(state.sort, effectiveList)),
    isLoading: query.isPending && query.fetchStatus !== 'idle',
    isFetching: query.isFetching,
    error: query.isError && !anchorLost ? errorMessage(query.error) : null,
    applyFilters: (filters) => navigateTo({ filters, sort: state.sort, anchors: [] }),
    resetFilters: () => navigateTo({ filters: {}, sort: null, anchors: [] }),
    toggleSort: (field) => navigateTo({ filters: state.filters, sort: nextSort(state.sort, field), anchors: [] }),
    nextPage: () => {
      const last = items.length > 0 ? itemId(items[items.length - 1]) : null;
      if (last) navigateTo({ ...state, anchors: [...state.anchors, last] });
    },
    prevPage: () => {
      if (state.anchors.length > 0) navigateTo({ ...state, anchors: state.anchors.slice(0, -1) });
    },
    refetch: () => void query.refetch(),
  };
}
